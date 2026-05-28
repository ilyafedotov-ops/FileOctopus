use std::sync::Arc;

use remote_core::ConnectionSessionManager;
use vfs::{
    DirectoryBatch, DirectorySink, ListOptions, ProviderCapabilities, ProviderId, ResourceUri,
    VfsError, VfsProvider,
};

use crate::connector::DropboxSession;

pub struct DropboxProvider {
    sessions: Arc<ConnectionSessionManager>,
}

impl DropboxProvider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self { sessions }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing dropbox profile id"))
    }

    async fn session_for(&self, uri: &ResourceUri) -> Result<(String, DropboxSession), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let session = self
            .sessions
            .session_for_profile(&profile_id)
            .await
            .map_err(VfsError::from)?;
        let dbx_session = session
            .as_any()
            .downcast_ref::<DropboxSession>()
            .ok_or_else(|| VfsError::internal("invalid dropbox session handle"))?;
        Ok((
            profile_id,
            DropboxSession::new(
                dbx_session.access_token().to_string(),
                dbx_session.profile_id().to_string(),
            ),
        ))
    }
}

#[async_trait::async_trait]
impl VfsProvider for DropboxProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("dropbox")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["dropbox"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_only()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<vfs::FileEntry, VfsError> {
        let (_, session) = self.session_for(uri).await?;
        let path = uri.remote_path().unwrap_or_default();

        let response = session
            .client()
            .post("https://api.dropboxapi.com/2/files/get_metadata")
            .bearer_auth(session.access_token())
            .json(&serde_json::json!({ "path": path }))
            .send()
            .await
            .map_err(|e| VfsError::internal(&format!("dropbox stat request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(VfsError::not_found(uri));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| VfsError::internal(&format!("dropbox stat parse failed: {e}")))?;

        crate::ops::dropbox_metadata_to_entry(&json)
            .ok_or_else(|| VfsError::internal("failed to parse dropbox file entry"))
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let (_, session) = self.session_for(uri).await?;
        let remote_path = uri.remote_path().unwrap_or_default();
        let path = if remote_path.is_empty() {
            "".to_string()
        } else {
            remote_path
        };

        let response = session
            .client()
            .post("https://api.dropboxapi.com/2/files/list_folder")
            .bearer_auth(session.access_token())
            .json(&serde_json::json!({
                "path": if path.is_empty() { "" } else { &path },
                "recursive": false
            }))
            .send()
            .await
            .map_err(|e| VfsError::internal(&format!("dropbox list request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(VfsError::internal("dropbox list request failed"));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| VfsError::internal(&format!("dropbox list parse failed: {e}")))?;

        let entries_val = json.get("entries").and_then(|e| e.as_array()).cloned();
        let entries: Vec<vfs::FileEntry> = entries_val
            .unwrap_or_default()
            .iter()
            .filter_map(crate::ops::dropbox_metadata_to_entry)
            .collect();

        let is_complete = !json
            .get("has_more")
            .and_then(|h| h.as_bool())
            .unwrap_or(false);

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
