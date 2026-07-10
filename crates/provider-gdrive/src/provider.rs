use std::sync::Arc;

use remote_core::ConnectionSessionManager;
use vfs::{
    DirectoryBatch, DirectorySink, ListOptions, ProviderCapabilities, ProviderId, ResourceUri,
    VfsError, VfsProvider,
};

use crate::connector::GDriveSession;

pub struct GDriveProvider {
    sessions: Arc<ConnectionSessionManager>,
}

impl GDriveProvider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self { sessions }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing gdrive profile id"))
    }

    async fn session_for(&self, uri: &ResourceUri) -> Result<(String, GDriveSession), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let gdrive_session = self
            .sessions
            .typed_session_for(&profile_id, "gdrive", |session: &GDriveSession| {
                GDriveSession::new(
                    session.access_token().to_string(),
                    session.profile_id().to_string(),
                )
            })
            .await
            .map_err(VfsError::from)?;
        Ok((profile_id, gdrive_session))
    }
}

#[async_trait::async_trait]
impl VfsProvider for GDriveProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("gdrive")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["gdrive"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_only()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<vfs::FileEntry, VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let remote_path = uri.remote_path().unwrap_or_default();
        let path = remote_path.trim_start_matches('/');
        let file_id = if path.is_empty() { "root" } else { path };

        let endpoint = if file_id == "root" {
            "https://www.googleapis.com/drive/v3/files/root?fields=id,name,mimeType,size,modifiedTime".to_string()
        } else {
            format!(
                "https://www.googleapis.com/drive/v3/files/{}?fields=id,name,mimeType,size,modifiedTime",
                file_id
            )
        };

        let response = session
            .client()
            .get(&endpoint)
            .bearer_auth(session.access_token())
            .send()
            .await
            .map_err(|e| VfsError::internal(&format!("gdrive stat request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(VfsError::not_found(uri));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| VfsError::internal(&format!("gdrive stat parse failed: {e}")))?;

        crate::ops::gdrive_file_to_entry(&profile_id, &json)
            .ok_or_else(|| VfsError::internal("failed to parse gdrive file entry"))
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;

        let remote_path = uri.remote_path().unwrap_or_default();
        let path = remote_path.trim_start_matches('/');
        let parent_id = if path.is_empty() { "root" } else { path };

        let query = if parent_id == "root" {
            "'root' in parents and trashed = false".to_string()
        } else {
            format!("'{}' in parents and trashed = false", parent_id)
        };

        let response = session
            .client()
            .get("https://www.googleapis.com/drive/v3/files")
            .query(&[
                ("q", query.as_str()),
                (
                    "fields",
                    "files(id,name,mimeType,size,modifiedTime,owners/emailAddress)",
                ),
                ("pageSize", "100"),
            ])
            .bearer_auth(session.access_token())
            .send()
            .await
            .map_err(|e| VfsError::internal(&format!("gdrive list request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(VfsError::internal("gdrive list request failed"));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| VfsError::internal(&format!("gdrive list parse failed: {e}")))?;

        let files = json
            .get("files")
            .and_then(|f| f.as_array())
            .cloned()
            .unwrap_or_default();

        let entries: Vec<vfs::FileEntry> = files
            .iter()
            .filter_map(|item| crate::ops::gdrive_file_to_entry(&profile_id, item))
            .collect();

        let is_complete = json.get("nextPageToken").and_then(|t| t.as_str()).is_none();

        sink.send(DirectoryBatch {
            session_id: options.session_id.clone(),
            request_id: options.request_id.clone(),
            uri: uri.clone(),
            entries,
            batch_index: 0,
            is_complete,
            total_hint: None,
        })
        .await
        .map_err(|_| VfsError::internal("directory sink closed"))?;

        Ok(())
    }
}
