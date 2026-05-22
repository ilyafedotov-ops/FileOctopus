use std::sync::Arc;

use remote_core::ConnectionSessionManager;
use vfs::{
    DirectoryBatch, DirectorySink, ListOptions, ProviderCapabilities, ProviderId, ResourceUri,
    VfsError, VfsProvider,
};

use crate::connector::{list_directory_incremental_blocking, stat_path_blocking, SftpSession};

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
        ProviderCapabilities::read_only()
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
        let cancel = options.cancel.clone();
        let batch_cancel = options.cancel.clone();

        tokio::task::spawn_blocking(move || {
            let mut batcher = IncrementalDirectoryBatcher::new(
                batch_uri,
                session_id,
                request_id,
                batch_size,
                batch_cancel,
                sink,
            );
            list_directory_incremental_blocking(
                &sftp_session,
                &list_uri,
                &remote_path,
                include_hidden,
                &cancel,
                |entry| batcher.push(entry),
            )?;
            batcher.finish()
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))??;

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }
}

struct IncrementalDirectoryBatcher {
    uri: ResourceUri,
    session_id: vfs::ListSessionId,
    request_id: String,
    batch_size: usize,
    cancel: vfs::ListCancellation,
    sink: DirectorySink,
    entries: Vec<vfs::FileEntry>,
    batch_index: u64,
}

impl IncrementalDirectoryBatcher {
    fn new(
        uri: ResourceUri,
        session_id: vfs::ListSessionId,
        request_id: String,
        batch_size: usize,
        cancel: vfs::ListCancellation,
        sink: DirectorySink,
    ) -> Self {
        let batch_size = batch_size.max(1);
        Self {
            uri,
            session_id,
            request_id,
            batch_size,
            cancel,
            sink,
            entries: Vec::with_capacity(batch_size),
            batch_index: 0,
        }
    }

    fn push(&mut self, entry: vfs::FileEntry) -> Result<(), VfsError> {
        if self.cancel.is_cancelled() {
            return Err(VfsError::cancelled(&self.uri));
        }

        self.entries.push(entry);
        if self.entries.len() >= self.batch_size {
            self.send(false)?;
        }

        Ok(())
    }

    fn finish(mut self) -> Result<(), VfsError> {
        if self.cancel.is_cancelled() {
            return Err(VfsError::cancelled(&self.uri));
        }

        self.send(true)
    }

    fn send(&mut self, is_complete: bool) -> Result<(), VfsError> {
        if self.cancel.is_cancelled() {
            return Err(VfsError::cancelled(&self.uri));
        }

        self.entries.sort_by_key(|entry| entry.name.to_lowercase());
        let entries = std::mem::take(&mut self.entries);
        self.sink
            .blocking_send(DirectoryBatch {
                session_id: self.session_id.clone(),
                request_id: self.request_id.clone(),
                uri: self.uri.clone(),
                entries,
                batch_index: self.batch_index,
                is_complete,
                total_hint: None,
            })
            .map_err(|_| VfsError::internal("directory sink closed"))?;
        self.batch_index += 1;
        self.entries = Vec::with_capacity(self.batch_size);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vfs::{
        EntryCapabilities, FileEntry, FileKind, ListCancellation, ListSessionId, ProviderId,
    };

    const PROFILE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

    #[test]
    fn incremental_batcher_emits_full_batches_before_finish() {
        let uri = ResourceUri::from_remote_profile("sftp", PROFILE_ID, "/").unwrap();
        let (sink, mut receiver) = tokio::sync::mpsc::channel(4);
        let mut batcher = IncrementalDirectoryBatcher::new(
            uri,
            ListSessionId::new("session-1"),
            "request-1".to_string(),
            2,
            ListCancellation::new(),
            sink,
        );

        batcher.push(entry("zeta.txt")).unwrap();
        assert!(receiver.try_recv().is_err());
        batcher.push(entry("alpha.txt")).unwrap();

        let first = receiver.try_recv().unwrap();
        assert_eq!(first.batch_index, 0);
        assert!(!first.is_complete);
        assert_eq!(first.total_hint, None);
        assert_eq!(entry_names(&first), vec!["alpha.txt", "zeta.txt"]);

        batcher.push(entry("middle.txt")).unwrap();
        assert!(receiver.try_recv().is_err());
        batcher.finish().unwrap();

        let final_batch = receiver.try_recv().unwrap();
        assert_eq!(final_batch.batch_index, 1);
        assert!(final_batch.is_complete);
        assert_eq!(final_batch.total_hint, None);
        assert_eq!(entry_names(&final_batch), vec!["middle.txt"]);
    }

    #[test]
    fn incremental_batcher_observes_cancellation_before_sending() {
        let uri = ResourceUri::from_remote_profile("sftp", PROFILE_ID, "/").unwrap();
        let (sink, _receiver) = tokio::sync::mpsc::channel(4);
        let cancel = ListCancellation::new();
        cancel.cancel();
        let mut batcher = IncrementalDirectoryBatcher::new(
            uri,
            ListSessionId::new("session-1"),
            "request-1".to_string(),
            2,
            cancel,
            sink,
        );

        let error = batcher.push(entry("alpha.txt")).unwrap_err();

        assert_eq!(error.code(), "cancelled");
    }

    fn entry(name: &str) -> FileEntry {
        let uri =
            ResourceUri::from_remote_profile("sftp", PROFILE_ID, &format!("/{name}")).unwrap();

        FileEntry {
            uri,
            name: name.to_string(),
            extension: Some("txt".to_string()),
            kind: FileKind::File,
            size: Some(1),
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            symlink_target: None,
            provider_id: ProviderId::new("sftp"),
            capabilities: EntryCapabilities::writable_file(),
            permissions: None,
            owner: None,
        }
    }

    fn entry_names(batch: &DirectoryBatch) -> Vec<&str> {
        batch
            .entries
            .iter()
            .map(|entry| entry.name.as_str())
            .collect()
    }
}
