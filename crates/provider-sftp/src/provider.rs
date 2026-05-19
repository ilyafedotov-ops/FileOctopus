use std::sync::Arc;

use remote_core::ConnectionSessionManager;
use vfs::{
    DirectoryBatch, DirectorySink, ListOptions, ProviderCapabilities, ProviderId, ResourceUri,
    VfsError, VfsProvider,
};

use crate::connector::{list_directory_blocking, stat_path_blocking, SftpSession};

pub struct SftpProvider {
    sessions: Arc<ConnectionSessionManager>,
}

impl SftpProvider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self { sessions }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing sftp profile id"))
    }
}

#[async_trait::async_trait]
impl VfsProvider for SftpProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("sftp")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["sftp"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_write()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<vfs::FileEntry, VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let remote_path = uri.remote_path().unwrap_or_else(|| "/".to_string());
        let session = self
            .sessions
            .session_for_profile(&profile_id)
            .await
            .map_err(VfsError::from)?;
        let sftp_session = session
            .as_any()
            .downcast_ref::<SftpSession>()
            .ok_or_else(|| VfsError::internal("invalid sftp session handle"))?
            .clone_handle();
        let uri = uri.clone();
        let entry = tokio::task::spawn_blocking(move || {
            stat_path_blocking(&sftp_session, &uri, &remote_path)
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))??;
        self.sessions.touch_session(&profile_id).await;
        Ok(entry)
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let remote_path = uri.remote_path().unwrap_or_else(|| "/".to_string());
        let session = self
            .sessions
            .session_for_profile(&profile_id)
            .await
            .map_err(VfsError::from)?;
        let sftp_session = session
            .as_any()
            .downcast_ref::<SftpSession>()
            .ok_or_else(|| VfsError::internal("invalid sftp session handle"))?
            .clone_handle();
        let batch_size = options.batch_size.max(1);
        let include_hidden = options.include_hidden;
        let list_uri = uri.clone();
        let batch_uri = uri.clone();
        let session_id = options.session_id.clone();
        let request_id = options.request_id.clone();

        let entries = tokio::task::spawn_blocking(move || {
            list_directory_blocking(&sftp_session, &list_uri, &remote_path, include_hidden)
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))??;

        if entries.is_empty() {
            sink.send(DirectoryBatch {
                session_id,
                request_id,
                uri: batch_uri,
                entries: Vec::new(),
                batch_index: 0,
                is_complete: true,
                total_hint: Some(0),
            })
            .await
            .map_err(|_| VfsError::internal("directory sink closed"))?;
        } else {
            let total = entries.len();
            for (batch_index, chunk) in entries.chunks(batch_size).enumerate() {
                let delivered = (batch_index + 1) * batch_size;
                sink.send(DirectoryBatch {
                    session_id: session_id.clone(),
                    request_id: request_id.clone(),
                    uri: batch_uri.clone(),
                    entries: chunk.to_vec(),
                    batch_index: batch_index as u64,
                    is_complete: delivered >= total,
                    total_hint: Some(total as u64),
                })
                .await
                .map_err(|_| VfsError::internal("directory sink closed"))?;
            }
        }

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }
}
