use std::sync::Arc;

use remote_core::ConnectionSessionManager;
use vfs::{
    DirectoryBatch, DirectorySink, ListOptions, ProviderCapabilities, ProviderId, ResourceUri,
    VfsError, VfsProvider,
};

use crate::connector::OneDriveSession;

pub struct OneDriveProvider {
    sessions: Arc<ConnectionSessionManager>,
}

impl OneDriveProvider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self { sessions }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing onedrive profile id"))
    }

    async fn session_for(&self, uri: &ResourceUri) -> Result<(String, OneDriveSession), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let od_session = self
            .sessions
            .typed_session_for(&profile_id, "onedrive", |session: &OneDriveSession| {
                OneDriveSession::new(
                    session.access_token().to_string(),
                    session.profile_id().to_string(),
                )
            })
            .await
            .map_err(VfsError::from)?;
        Ok((profile_id, od_session))
    }
}

#[async_trait::async_trait]
impl VfsProvider for OneDriveProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("onedrive")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["onedrive"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_only()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<vfs::FileEntry, VfsError> {
        let (_, session) = self.session_for(uri).await?;
        let remote_path = uri.remote_path().unwrap_or_default();
        let path = remote_path.trim_start_matches('/');
        let endpoint = if path.is_empty() || path == "root" {
            "https://graph.microsoft.com/v1.0/me/drive/root".to_string()
        } else {
            format!("https://graph.microsoft.com/v1.0/me/drive/root:{}", path)
        };

        let response = session
            .client()
            .get(&endpoint)
            .bearer_auth(session.access_token())
            .send()
            .await
            .map_err(|e| VfsError::internal(&format!("onedrive stat request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(VfsError::not_found(uri));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| VfsError::internal(&format!("onedrive stat parse failed: {e}")))?;

        crate::ops::onedrive_item_to_entry(&json)
            .ok_or_else(|| VfsError::internal("failed to parse onedrive file entry"))
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let (_, session) = self.session_for(uri).await?;
        let remote_path = uri.remote_path().unwrap_or_default();
        let path = remote_path.trim_start_matches('/');
        let endpoint = if path.is_empty() || path == "root" {
            "https://graph.microsoft.com/v1.0/me/drive/root/children".to_string()
        } else {
            format!(
                "https://graph.microsoft.com/v1.0/me/drive/root:{}:/children",
                path
            )
        };

        let response = session
            .client()
            .get(&endpoint)
            .bearer_auth(session.access_token())
            .send()
            .await
            .map_err(|e| VfsError::internal(&format!("onedrive list request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(VfsError::internal("onedrive list request failed"));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| VfsError::internal(&format!("onedrive list parse failed: {e}")))?;

        let entries: Vec<vfs::FileEntry> = json
            .get("value")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(crate::ops::onedrive_item_to_entry)
            .collect();

        let is_complete = json
            .get("@odata.nextLink")
            .and_then(|l| l.as_str())
            .is_none();

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
