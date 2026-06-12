use std::sync::Arc;

use remote_core::{run_blocking_io, ConnectionSessionManager};
use vfs::{
    DirectoryBatch, DirectorySink, FileKind, ListOptions, ProviderCapabilities, ProviderId,
    ResourceUri, VfsError, VfsProvider,
};

use crate::connector::SmbSession;
use crate::ops::{
    copy_file_blocking, create_empty_file_blocking, join_remote_path, list_directory_blocking,
    mkdir_blocking, read_file_prefix_blocking, remove_dir_blocking, remove_file_blocking,
    rename_blocking,
};

pub struct SmbProvider {
    sessions: Arc<ConnectionSessionManager>,
}

impl SmbProvider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self { sessions }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing smb profile id"))
    }

    async fn session_for(&self, uri: &ResourceUri) -> Result<(String, SmbSession), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let smb_session = self
            .sessions
            .typed_session_for(&profile_id, "smb", SmbSession::clone_handle)
            .await
            .map_err(VfsError::from)?;
        Ok((profile_id, smb_session))
    }

    fn remote_path_for(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_path()
            .filter(|path| !path.is_empty())
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing smb remote path"))
    }
}

fn remove_smb_tree_blocking(
    session: &SmbSession,
    uri: &ResourceUri,
    path: &str,
) -> Result<(), VfsError> {
    let cancel = vfs::ListCancellation::new();
    let mut entries = Vec::new();
    list_directory_blocking(session, uri, path, true, &cancel, |entry| {
        entries.push(entry);
        Ok(())
    })?;
    for entry in entries {
        let child_path = join_remote_path(path, &entry.name);
        let child_uri = ResourceUri::from_remote_profile(
            "smb",
            uri.remote_authority().unwrap_or_default(),
            &child_path,
        )?;
        if entry.kind == FileKind::Directory {
            remove_smb_tree_blocking(session, &child_uri, &child_path)?;
        } else {
            remove_file_blocking(session, &child_uri, &child_path)?;
        }
    }
    remove_dir_blocking(session, uri, path)
}

#[async_trait::async_trait]
impl VfsProvider for SmbProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("smb")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["smb"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_write()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<vfs::FileEntry, VfsError> {
        let (profile_id, smb_session) = self.session_for(uri).await?;
        let remote_path = uri.remote_path().unwrap_or_else(|| "/".to_string());
        let uri_clone = uri.clone();
        let entry = run_blocking_io(move || {
            crate::ops::stat_path_blocking(&smb_session, &uri_clone, &remote_path)
        })
        .await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(entry)
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let (profile_id, smb_session) = self.session_for(uri).await?;
        let remote_path = uri.remote_path().unwrap_or_else(|| "/".to_string());
        let batch_size = options.batch_size.max(1);
        let include_hidden = options.include_hidden;
        let list_uri = uri.clone();
        let batch_uri = uri.clone();
        let session_id = options.session_id.clone();
        let request_id = options.request_id.clone();
        let cancel = options.cancel.clone();
        let batch_cancel = options.cancel.clone();

        run_blocking_io(move || {
            let mut batcher = IncrementalDirectoryBatcher::new(
                batch_uri,
                session_id,
                request_id,
                batch_size,
                batch_cancel,
                sink,
            );
            list_directory_blocking(
                &smb_session,
                &list_uri,
                &remote_path,
                include_hidden,
                &cancel,
                |entry| batcher.push(entry),
            )?;
            batcher.finish()
        })
        .await?;

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let (profile_id, smb_session) = self.session_for(uri).await?;
        let remote_path = Self::remote_path_for(uri)?;
        let uri_clone = uri.clone();
        run_blocking_io(move || mkdir_blocking(&smb_session, &uri_clone, &remote_path)).await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let (profile_id, smb_session) = self.session_for(uri).await?;
        let remote_path = Self::remote_path_for(uri)?;
        let uri_clone = uri.clone();
        run_blocking_io(move || create_empty_file_blocking(&smb_session, &uri_clone, &remote_path))
            .await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
        let from_authority = Self::profile_id_for_uri(from)?;
        let to_authority = Self::profile_id_for_uri(to)?;
        if from_authority != to_authority {
            return Err(VfsError::UnsupportedOperation {
                scheme: "smb".to_string(),
                operation: "rename across profiles",
            });
        }
        let (profile_id, smb_session) = self.session_for(from).await?;
        let from_path = Self::remote_path_for(from)?;
        let to_path = Self::remote_path_for(to)?;
        let from_clone = from.clone();
        run_blocking_io(move || rename_blocking(&smb_session, &from_clone, &from_path, &to_path))
            .await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
        let (profile_id, smb_session) = self.session_for(uri).await?;
        let remote_path = Self::remote_path_for(uri)?;
        let uri_clone = uri.clone();
        let entry = self.stat(uri).await?;
        run_blocking_io(move || match (entry.kind, recursive) {
            (FileKind::Directory, true) => {
                remove_smb_tree_blocking(&smb_session, &uri_clone, &remote_path)
            }
            (FileKind::Directory, false) => {
                remove_dir_blocking(&smb_session, &uri_clone, &remote_path)
            }
            _ => remove_file_blocking(&smb_session, &uri_clone, &remote_path),
        })
        .await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        mut on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        let source_authority = Self::profile_id_for_uri(source)?;
        let dest_authority = Self::profile_id_for_uri(destination)?;
        if source_authority != dest_authority {
            return Err(VfsError::UnsupportedOperation {
                scheme: "smb".to_string(),
                operation: "copy_file across profiles",
            });
        }
        let (profile_id, smb_session) = self.session_for(source).await?;
        let source_path = Self::remote_path_for(source)?;
        let dest_path = Self::remote_path_for(destination)?;
        let source_clone = source.clone();
        let dest_clone = destination.clone();
        let total = run_blocking_io(move || {
            copy_file_blocking(
                &smb_session,
                &source_clone,
                &source_path,
                &dest_clone,
                &dest_path,
                &mut *on_progress,
            )
        })
        .await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(total)
    }

    async fn read_file_prefix(
        &self,
        uri: &ResourceUri,
        max_bytes: u64,
    ) -> Result<Vec<u8>, VfsError> {
        let (profile_id, smb_session) = self.session_for(uri).await?;
        let remote_path = Self::remote_path_for(uri)?;
        let uri_clone = uri.clone();
        let bytes = run_blocking_io(move || {
            read_file_prefix_blocking(&smb_session, &uri_clone, &remote_path, max_bytes)
        })
        .await?;
        self.sessions.touch_session(&profile_id).await;
        Ok(bytes)
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
        let uri = ResourceUri::from_remote_profile("smb", PROFILE_ID, "/").unwrap();
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
        assert_eq!(entry_names(&first), vec!["alpha.txt", "zeta.txt"]);

        batcher.push(entry("middle.txt")).unwrap();
        assert!(receiver.try_recv().is_err());
        batcher.finish().unwrap();

        let final_batch = receiver.try_recv().unwrap();
        assert_eq!(final_batch.batch_index, 1);
        assert!(final_batch.is_complete);
        assert_eq!(entry_names(&final_batch), vec!["middle.txt"]);
    }

    #[test]
    fn incremental_batcher_observes_cancellation_before_sending() {
        let uri = ResourceUri::from_remote_profile("smb", PROFILE_ID, "/").unwrap();
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
        let uri = ResourceUri::from_remote_profile("smb", PROFILE_ID, &format!("/{name}")).unwrap();
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
            is_placeholder: false,
            symlink_target: None,
            provider_id: ProviderId::new("smb"),
            capabilities: EntryCapabilities::writable_file(),
            permissions: None,
            owner: None,
        }
    }

    fn entry_names(batch: &DirectoryBatch) -> Vec<&str> {
        batch.entries.iter().map(|e| e.name.as_str()).collect()
    }
}
