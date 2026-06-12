//! `VfsFilesystem` orchestrates cross-scheme file operations and exposes
//! single-URI write helpers as thin facades over `VfsProvider` trait methods.
//! Per-scheme write logic lives on `VfsProvider` implementations; this file
//! only owns cross-scheme copy orchestration and a handful of local-only
//! helpers (range reads, atomic writes) that aren't yet on the trait.

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use provider_sftp::{
    download_file_blocking, list_directory_blocking, upload_file_blocking, SftpSession,
};
use remote_core::ConnectionSessionManager;
use vfs::{DirectoryBatch, FileEntry, FileKind, FileOperationError, ResourceUri, VfsRegistry};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CrossSchemeTransfer {
    LocalToSftp,
    SftpToLocal,
}

#[derive(Clone)]
pub struct VfsFilesystem {
    sessions: Option<Arc<ConnectionSessionManager>>,
    registry: Arc<VfsRegistry>,
}

impl VfsFilesystem {
    pub fn local_only(registry: Arc<VfsRegistry>) -> Self {
        Self {
            sessions: None,
            registry,
        }
    }

    pub fn with_sessions(
        sessions: Arc<ConnectionSessionManager>,
        registry: Arc<VfsRegistry>,
    ) -> Self {
        Self {
            sessions: Some(sessions),
            registry,
        }
    }

    pub fn validate_uri(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
        match uri.scheme() {
            "local" => {
                uri.to_local_path()?;
                Ok(())
            }
            scheme if vfs::REMOTE_SCHEMES.contains(&scheme) => {
                self.registry
                    .provider_for(uri)
                    .map_err(FileOperationError::from)?;
                uri.remote_authority()
                    .ok_or_else(|| FileOperationError::InvalidPath {
                        uri: uri.as_str().to_string(),
                        message: "missing remote profile id".to_string(),
                    })?;
                Ok(())
            }
            scheme => Err(FileOperationError::UnsupportedProvider {
                scheme: scheme.to_string(),
            }),
        }
    }

    pub fn exists(&self, uri: &ResourceUri) -> Result<bool, FileOperationError> {
        match self.stat_kind(uri) {
            Ok(_) => Ok(true),
            Err(FileOperationError::NotFound { .. }) => Ok(false),
            Err(error) => Err(error),
        }
    }

    pub fn stat_kind(&self, uri: &ResourceUri) -> Result<FileKind, FileOperationError> {
        if uri.scheme() == "local" {
            let path = uri.to_local_path()?;
            let metadata = fs::symlink_metadata(&path).map_err(|error| map_local_io(uri, error))?;
            return Ok(file_kind(&metadata));
        }

        Ok(self.stat_entry(uri)?.kind)
    }

    pub fn file_size(&self, uri: &ResourceUri) -> Result<u64, FileOperationError> {
        if uri.scheme() == "local" {
            let path = uri.to_local_path()?;
            let metadata = fs::metadata(&path).map_err(|error| map_local_io(uri, error))?;
            return Ok(metadata.len());
        }

        Ok(self.stat_entry(uri)?.size.unwrap_or(0))
    }

    fn stat_entry(&self, uri: &ResourceUri) -> Result<FileEntry, FileOperationError> {
        let provider = self
            .registry
            .provider_for(uri)
            .map_err(FileOperationError::from)?;
        let uri_clone = uri.clone();
        block_on_vfs(async move { provider.stat(&uri_clone).await })
    }

    fn list_entries(&self, uri: &ResourceUri) -> Result<Vec<FileEntry>, FileOperationError> {
        let provider = self
            .registry
            .provider_for(uri)
            .map_err(FileOperationError::from)?;
        let uri_clone = uri.clone();
        block_on_vfs(async move {
            let (sender, mut receiver) = tokio::sync::mpsc::channel::<DirectoryBatch>(16);
            let request_uri = uri_clone.clone();
            let drain = tokio::spawn(async move {
                let mut entries = Vec::new();
                while let Some(batch) = receiver.recv().await {
                    entries.extend(batch.entries);
                    if batch.is_complete {
                        break;
                    }
                }
                entries
            });

            provider
                .list(
                    &request_uri,
                    vfs::ListOptions {
                        session_id: vfs::ListSessionId::new("provider-neutral-plan"),
                        request_id: "provider-neutral-plan".to_string(),
                        batch_size: 256,
                        include_hidden: false,
                        cancel: vfs::ListCancellation::new(),
                    },
                    sender,
                )
                .await?;
            drain.await.map_err(|error| vfs::VfsError::Internal {
                message: format!("provider list drain failed: {error}"),
            })
        })
    }

    pub fn read_file_prefix(
        &self,
        uri: &ResourceUri,
        max_bytes: u64,
    ) -> Result<Vec<u8>, FileOperationError> {
        let provider = self
            .registry
            .provider_for(uri)
            .map_err(FileOperationError::from)?;
        let uri_clone = uri.clone();
        block_on_vfs(async move { provider.read_file_prefix(&uri_clone, max_bytes).await })
    }

    /// Read `length` bytes starting at `offset`. Returns the actual bytes read
    /// and the total file size (capped at u64::MAX).
    ///
    /// Local-only in v1; remote URIs return `UnsupportedProvider`.
    pub fn read_file_range(
        &self,
        uri: &ResourceUri,
        offset: u64,
        length: u64,
    ) -> Result<(Vec<u8>, u64), FileOperationError> {
        if uri.scheme() != "local" {
            return Err(FileOperationError::UnsupportedProvider {
                scheme: uri.scheme().to_string(),
            });
        }

        let path = uri.to_local_path()?;
        let metadata = fs::metadata(&path).map_err(|error| map_local_io(uri, error))?;
        let total_size = metadata.len();

        if offset >= total_size {
            return Ok((Vec::new(), total_size));
        }

        let mut file = File::open(&path).map_err(|error| map_local_io(uri, error))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| map_local_io(uri, error))?;

        let remaining = total_size - offset;
        let to_read = length.min(remaining) as usize;
        let mut buffer = vec![0_u8; to_read];
        let read = file
            .read(&mut buffer)
            .map_err(|error| map_local_io(uri, error))?;
        buffer.truncate(read);
        Ok((buffer, total_size))
    }

    /// Write `content` to `uri` atomically by staging to a sibling temp file
    /// and renaming over the destination. Local-only in v1.
    ///
    /// Creates the file if it does not exist; otherwise replaces it. Parent
    /// directory must already exist.
    pub fn write_file_atomic(
        &self,
        uri: &ResourceUri,
        content: &[u8],
    ) -> Result<(), FileOperationError> {
        if uri.scheme() != "local" {
            return Err(FileOperationError::UnsupportedProvider {
                scheme: uri.scheme().to_string(),
            });
        }

        let path = uri.to_local_path()?;
        let parent = path
            .parent()
            .ok_or_else(|| FileOperationError::DestinationMissing {
                uri: uri.as_str().to_string(),
            })?;
        if !parent.is_dir() {
            return Err(FileOperationError::DestinationMissing {
                uri: uri.as_str().to_string(),
            });
        }

        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| FileOperationError::InvalidPath {
                uri: uri.as_str().to_string(),
                message: "destination has no file name".to_string(),
            })?;

        let temp_name = format!(".{file_name}.fileoctopus-tmp.{}", uuid::Uuid::new_v4());
        let temp_path = parent.join(temp_name);

        {
            let mut temp = File::create(&temp_path).map_err(|error| {
                let _ = fs::remove_file(&temp_path);
                map_local_io(uri, error)
            })?;
            if let Err(error) = temp.write_all(content) {
                let _ = fs::remove_file(&temp_path);
                return Err(map_local_io(uri, error));
            }
            if let Err(error) = temp.sync_all() {
                let _ = fs::remove_file(&temp_path);
                return Err(map_local_io(uri, error));
            }
        }

        if let Err(error) = fs::rename(&temp_path, &path) {
            let _ = fs::remove_file(&temp_path);
            return Err(map_local_io(uri, error));
        }

        Ok(())
    }

    pub fn mkdir(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
        let provider = self
            .registry
            .provider_for(uri)
            .map_err(FileOperationError::from)?;
        let uri_clone = uri.clone();
        block_on_vfs(async move { provider.create_directory(&uri_clone).await })
    }

    pub fn create_empty_file(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
        let provider = self
            .registry
            .provider_for(uri)
            .map_err(FileOperationError::from)?;
        let uri_clone = uri.clone();
        block_on_vfs(async move { provider.create_file(&uri_clone).await })
    }

    pub fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), FileOperationError> {
        if from.scheme() != to.scheme() {
            return Err(FileOperationError::UnsupportedProvider {
                scheme: format!("{}->{}", from.scheme(), to.scheme()),
            });
        }

        if from.scheme() == "sftp" {
            let from_profile = from.remote_authority().ok_or_else(|| invalid_path(from))?;
            let to_profile = to.remote_authority().ok_or_else(|| invalid_path(to))?;
            if from_profile != to_profile {
                self.copy_file(from, to, |_| {})?;
                self.remove(from, true)?;
                return Ok(());
            }
        }

        let provider = self
            .registry
            .provider_for(from)
            .map_err(FileOperationError::from)?;
        let from_clone = from.clone();
        let to_clone = to.clone();
        block_on_vfs(async move { provider.rename(&from_clone, &to_clone).await })
    }

    pub fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), FileOperationError> {
        let provider = self
            .registry
            .provider_for(uri)
            .map_err(FileOperationError::from)?;
        let uri_clone = uri.clone();
        block_on_vfs(async move { provider.remove(&uri_clone, recursive).await })
    }

    pub fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        mut on_progress: impl FnMut(u64),
    ) -> Result<u64, FileOperationError> {
        if source.scheme() == destination.scheme() {
            let provider = self
                .registry
                .provider_for(source)
                .map_err(FileOperationError::from)?;
            let source_clone = source.clone();
            let destination_clone = destination.clone();
            let (tx, rx) = std::sync::mpsc::sync_channel::<u64>(64);

            let worker = std::thread::spawn(move || -> Result<u64, FileOperationError> {
                let progress_callback: Box<dyn FnMut(u64) + Send> = Box::new(move |bytes| {
                    let _ = tx.send(bytes);
                });
                tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .map_err(|error| FileOperationError::Internal {
                        message: error.to_string(),
                    })?
                    .block_on(provider.copy_file(
                        &source_clone,
                        &destination_clone,
                        progress_callback,
                    ))
                    .map_err(FileOperationError::from)
            });

            while let Ok(bytes) = rx.recv() {
                on_progress(bytes);
            }

            return worker.join().map_err(|_| FileOperationError::Internal {
                message: "copy worker thread panicked".to_string(),
            })?;
        }
        self.copy_file_cross_scheme(source, destination, on_progress)
    }

    fn copy_file_cross_scheme(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        on_progress: impl FnMut(u64),
    ) -> Result<u64, FileOperationError> {
        match cross_scheme_transfer_for(source, destination)? {
            CrossSchemeTransfer::LocalToSftp => {
                let from = source.to_local_path()?;
                let session = self.sftp_session(destination)?;
                let dest_path = remote_path(destination)?;
                let file = File::open(&from).map_err(|error| map_local_io(source, error))?;
                upload_file_blocking(&session, destination, &dest_path, file, on_progress)
                    .map_err(FileOperationError::from)
            }
            CrossSchemeTransfer::SftpToLocal => {
                let to = destination.to_local_path()?;
                if let Some(parent) = to.parent() {
                    fs::create_dir_all(parent).map_err(|error| map_local_io(destination, error))?;
                }
                let session = self.sftp_session(source)?;
                let source_path = remote_path(source)?;
                let file = File::create(&to).map_err(|error| map_local_io(destination, error))?;
                download_file_blocking(&session, source, &source_path, file, on_progress)
                    .map_err(FileOperationError::from)
            }
        }
    }

    pub fn local_path(&self, uri: &ResourceUri) -> Result<PathBuf, FileOperationError> {
        uri.to_local_path().map_err(FileOperationError::from)
    }

    pub fn join_local_parent(
        &self,
        parent: &ResourceUri,
        name: &str,
    ) -> Result<ResourceUri, FileOperationError> {
        if parent.scheme() != "local" {
            return Err(FileOperationError::InvalidPath {
                uri: parent.as_str().to_string(),
                message: "expected local parent".to_string(),
            });
        }
        let path = parent.to_local_path()?;
        ResourceUri::from_local_path(&path.join(name)).map_err(FileOperationError::from)
    }

    pub fn join_remote_parent(
        &self,
        parent: &ResourceUri,
        name: &str,
    ) -> Result<ResourceUri, FileOperationError> {
        let profile_id = parent
            .remote_authority()
            .ok_or_else(|| invalid_path(parent))?;
        let base = remote_path(parent)?;
        let joined = if base.ends_with('/') {
            format!("{base}{name}")
        } else {
            format!("{base}/{name}")
        };
        ResourceUri::from_remote_profile(parent.scheme(), profile_id, &joined)
            .map_err(FileOperationError::from)
    }

    pub fn parent_local(&self, uri: &ResourceUri) -> Result<PathBuf, FileOperationError> {
        let path = uri.to_local_path()?;
        path.parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "path has no parent".to_string(),
            })
    }

    pub fn collect_copy_items(
        &self,
        source: &ResourceUri,
        destination_dir: &ResourceUri,
        warnings: &mut Vec<vfs::FileOperationWarning>,
    ) -> Result<Vec<vfs::FileOperationItem>, FileOperationError> {
        if source.scheme() == "local" && destination_dir.scheme() == "local" {
            return collect_local_copy_items(source, destination_dir, warnings);
        }

        if source.scheme() == destination_dir.scheme() {
            return self.collect_provider_copy_items(source, destination_dir, warnings);
        }

        match cross_scheme_transfer_for(source, destination_dir)? {
            CrossSchemeTransfer::LocalToSftp => {
                collect_local_to_remote_copy_items(self, source, destination_dir, warnings)
            }
            CrossSchemeTransfer::SftpToLocal => {
                collect_remote_to_local_copy_items(self, source, destination_dir, warnings)
            }
        }
    }

    fn collect_provider_copy_items(
        &self,
        source: &ResourceUri,
        destination_dir: &ResourceUri,
        warnings: &mut Vec<vfs::FileOperationWarning>,
    ) -> Result<Vec<vfs::FileOperationItem>, FileOperationError> {
        let dest_profile = destination_dir
            .remote_authority()
            .ok_or_else(|| invalid_path(destination_dir))?;
        let source_path = remote_path(source)?;
        let source_name = remote_basename(&source_path, "source");
        let dest_base = join_remote(&remote_path(destination_dir)?, &source_name);
        let mut items = Vec::new();
        self.walk_provider_copy(source, dest_profile, &dest_base, &mut items, warnings)?;
        Ok(items)
    }

    #[allow(clippy::too_many_arguments)]
    fn walk_provider_copy(
        &self,
        source_uri: &ResourceUri,
        dest_profile: &str,
        dest_path: &str,
        items: &mut Vec<vfs::FileOperationItem>,
        warnings: &mut Vec<vfs::FileOperationWarning>,
    ) -> Result<(), FileOperationError> {
        let entry = self.stat_entry(source_uri)?;
        let kind = entry.kind;

        if kind == FileKind::Directory {
            let entries = self.list_entries(source_uri)?;
            let dest_uri =
                ResourceUri::from_remote_profile(source_uri.scheme(), dest_profile, dest_path)
                    .map_err(FileOperationError::from)?;
            items.push(vfs::FileOperationItem {
                source: Some(source_uri.clone()),
                destination: Some(dest_uri),
                kind: FileKind::Directory,
                size: None,
                recursive: true,
            });

            for entry in entries {
                let child_dest_path = join_remote(dest_path, &entry.name);
                if entry.kind == FileKind::Directory {
                    self.walk_provider_copy(
                        &entry.uri,
                        dest_profile,
                        &child_dest_path,
                        items,
                        warnings,
                    )?;
                } else if entry.kind == FileKind::File {
                    let child_dest_uri = ResourceUri::from_remote_profile(
                        source_uri.scheme(),
                        dest_profile,
                        &child_dest_path,
                    )
                    .map_err(FileOperationError::from)?;
                    items.push(vfs::FileOperationItem {
                        source: Some(entry.uri),
                        destination: Some(child_dest_uri),
                        kind: FileKind::File,
                        size: entry.size,
                        recursive: false,
                    });
                }
            }
        } else {
            let dest_uri =
                ResourceUri::from_remote_profile(source_uri.scheme(), dest_profile, dest_path)
                    .map_err(FileOperationError::from)?;
            items.push(vfs::FileOperationItem {
                source: Some(source_uri.clone()),
                destination: Some(dest_uri),
                kind: FileKind::File,
                size: entry.size,
                recursive: false,
            });
        }

        let _ = warnings;
        Ok(())
    }

    fn sftp_session(&self, uri: &ResourceUri) -> Result<SftpSession, FileOperationError> {
        let sessions =
            self.sessions
                .as_ref()
                .ok_or_else(|| FileOperationError::UnsupportedProvider {
                    scheme: uri.scheme().to_string(),
                })?;
        let profile_id = uri
            .remote_authority()
            .ok_or_else(|| invalid_path(uri))?
            .to_string();
        let sessions = Arc::clone(sessions);
        let connect_profile = profile_id.clone();
        let handle =
            block_on_session(async move { sessions.session_for_profile(&connect_profile).await })?;
        let session = handle
            .as_any()
            .downcast_ref::<SftpSession>()
            .ok_or_else(|| FileOperationError::Internal {
                message: "invalid sftp session handle".to_string(),
            })?
            .clone_handle();
        let sessions = Arc::clone(self.sessions.as_ref().ok_or_else(|| {
            FileOperationError::UnsupportedProvider {
                scheme: uri.scheme().to_string(),
            }
        })?);
        block_on_session(async move {
            sessions.touch_session(&profile_id).await;
            Ok::<(), remote_core::RemoteError>(())
        })?;
        Ok(session)
    }
}

fn block_on_session<T>(
    future: impl std::future::Future<Output = Result<T, remote_core::RemoteError>> + Send + 'static,
) -> Result<T, FileOperationError>
where
    T: Send + 'static,
{
    let run = || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| FileOperationError::Internal {
                message: error.to_string(),
            })?
            .block_on(future)
            .map_err(|error| FileOperationError::from(vfs::VfsError::from(error)))
    };

    if tokio::runtime::Handle::try_current().is_ok() {
        std::thread::spawn(run)
            .join()
            .map_err(|_| FileOperationError::Internal {
                message: "session worker thread panicked".to_string(),
            })?
    } else {
        run()
    }
}

fn block_on_vfs<T>(
    future: impl std::future::Future<Output = Result<T, vfs::VfsError>> + Send + 'static,
) -> Result<T, FileOperationError>
where
    T: Send + 'static,
{
    let run = || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| FileOperationError::Internal {
                message: error.to_string(),
            })?
            .block_on(future)
            .map_err(FileOperationError::from)
    };

    if tokio::runtime::Handle::try_current().is_ok() {
        std::thread::spawn(run)
            .join()
            .map_err(|_| FileOperationError::Internal {
                message: "vfs worker thread panicked".to_string(),
            })?
    } else {
        run()
    }
}

fn remote_path(uri: &ResourceUri) -> Result<String, FileOperationError> {
    uri.remote_path()
        .filter(|path| !path.is_empty())
        .ok_or_else(|| invalid_path(uri))
}

fn invalid_path(uri: &ResourceUri) -> FileOperationError {
    FileOperationError::InvalidPath {
        uri: uri.as_str().to_string(),
        message: "invalid remote path".to_string(),
    }
}

fn join_remote(base: &str, name: &str) -> String {
    if base.ends_with('/') {
        format!("{base}{name}")
    } else {
        format!("{base}/{name}")
    }
}

fn remote_basename(path: &str, fallback: &str) -> String {
    path.trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn file_kind(metadata: &fs::Metadata) -> FileKind {
    if metadata.file_type().is_symlink() {
        FileKind::Symlink
    } else if metadata.is_dir() {
        FileKind::Directory
    } else if metadata.is_file() {
        FileKind::File
    } else {
        FileKind::Unknown
    }
}

fn map_local_io(uri: &ResourceUri, error: std::io::Error) -> FileOperationError {
    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_uri(uri, &error),
        _ => FileOperationError::io(error.to_string()),
    }
}

fn cross_scheme_transfer_for(
    source: &ResourceUri,
    destination: &ResourceUri,
) -> Result<CrossSchemeTransfer, FileOperationError> {
    match (source.scheme(), destination.scheme()) {
        ("local", "sftp") => Ok(CrossSchemeTransfer::LocalToSftp),
        ("sftp", "local") => Ok(CrossSchemeTransfer::SftpToLocal),
        (from, to) => Err(FileOperationError::UnsupportedProvider {
            scheme: format!("{from}->{to}"),
        }),
    }
}

fn collect_local_copy_items(
    source: &ResourceUri,
    destination_dir: &ResourceUri,
    warnings: &mut Vec<vfs::FileOperationWarning>,
) -> Result<Vec<vfs::FileOperationItem>, FileOperationError> {
    use crate::file_ops::planning::collect_copy_or_move_items;

    let source_path = source.to_local_path()?;
    let destination_path = destination_dir.to_local_path()?;
    let mut items = Vec::new();
    collect_copy_or_move_items(
        &source_path,
        &destination_path,
        &source_path,
        &mut items,
        warnings,
    )?;
    Ok(items)
}

fn collect_local_to_remote_copy_items(
    _vfs: &VfsFilesystem,
    source: &ResourceUri,
    destination_dir: &ResourceUri,
    warnings: &mut Vec<vfs::FileOperationWarning>,
) -> Result<Vec<vfs::FileOperationItem>, FileOperationError> {
    let source_path = source.to_local_path()?;
    let metadata =
        fs::symlink_metadata(&source_path).map_err(|error| map_local_io(source, error))?;
    let dest_profile = destination_dir
        .remote_authority()
        .ok_or_else(|| invalid_path(destination_dir))?;
    let dest_base = remote_path(destination_dir)?;
    let mut items = Vec::new();

    if metadata.is_dir() {
        let dest_uri = ResourceUri::from_remote_profile("sftp", dest_profile, &dest_base)
            .map_err(FileOperationError::from)?;
        items.push(vfs::FileOperationItem {
            source: Some(source.clone()),
            destination: Some(dest_uri),
            kind: FileKind::Directory,
            size: None,
            recursive: true,
        });
        walk_local_to_remote(&source_path, source, dest_profile, &dest_base, &mut items)?;
    } else {
        let name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("file");
        let dest_path = join_remote(&dest_base, name);
        let dest_uri = ResourceUri::from_remote_profile("sftp", dest_profile, &dest_path)
            .map_err(FileOperationError::from)?;
        items.push(vfs::FileOperationItem {
            source: Some(source.clone()),
            destination: Some(dest_uri),
            kind: FileKind::File,
            size: Some(metadata.len()),
            recursive: false,
        });
    }

    let _ = warnings;
    Ok(items)
}

fn walk_local_to_remote(
    source_path: &Path,
    source_uri: &ResourceUri,
    dest_profile: &str,
    dest_path: &str,
    items: &mut Vec<vfs::FileOperationItem>,
) -> Result<(), FileOperationError> {
    for entry in fs::read_dir(source_path).map_err(|error| map_local_io(source_uri, error))? {
        let entry = entry.map_err(|error| map_local_io(source_uri, error))?;
        let name = entry.file_name().to_string_lossy().to_string();
        let child_source_path = source_path.join(&name);
        let child_source_uri =
            ResourceUri::from_local_path(&child_source_path).map_err(FileOperationError::from)?;
        let child_dest_path = join_remote(dest_path, &name);
        let metadata = entry
            .metadata()
            .or_else(|_| fs::symlink_metadata(&child_source_path))
            .map_err(|error| map_local_io(&child_source_uri, error))?;
        if metadata.is_dir() {
            walk_local_to_remote(
                &child_source_path,
                &child_source_uri,
                dest_profile,
                &child_dest_path,
                items,
            )?;
        } else if metadata.is_file() {
            let child_dest_uri =
                ResourceUri::from_remote_profile("sftp", dest_profile, &child_dest_path)
                    .map_err(FileOperationError::from)?;
            items.push(vfs::FileOperationItem {
                source: Some(child_source_uri),
                destination: Some(child_dest_uri),
                kind: FileKind::File,
                size: Some(metadata.len()),
                recursive: false,
            });
        }
    }
    Ok(())
}

fn collect_remote_to_local_copy_items(
    vfs: &VfsFilesystem,
    source: &ResourceUri,
    destination_dir: &ResourceUri,
    _warnings: &mut Vec<vfs::FileOperationWarning>,
) -> Result<Vec<vfs::FileOperationItem>, FileOperationError> {
    let session = vfs.sftp_session(source)?;
    let source_path = remote_path(source)?;
    let dest_path = destination_dir.to_local_path()?;
    let mut items = Vec::new();
    walk_remote_to_local(
        vfs,
        &session,
        source,
        &source_path,
        &dest_path,
        destination_dir,
        &mut items,
    )?;
    Ok(items)
}

#[allow(clippy::too_many_arguments)]
fn walk_remote_to_local(
    vfs: &VfsFilesystem,
    session: &SftpSession,
    source_uri: &ResourceUri,
    source_path: &str,
    dest_dir: &Path,
    _dest_dir_uri: &ResourceUri,
    items: &mut Vec<vfs::FileOperationItem>,
) -> Result<(), FileOperationError> {
    let kind = vfs.stat_kind(source_uri)?;
    if kind == FileKind::Directory {
        let name = source_path
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or("dir");
        let child_dest = dest_dir.join(name);
        let child_dest_uri =
            ResourceUri::from_local_path(&child_dest).map_err(FileOperationError::from)?;
        items.push(vfs::FileOperationItem {
            source: Some(source_uri.clone()),
            destination: Some(child_dest_uri.clone()),
            kind: FileKind::Directory,
            size: None,
            recursive: true,
        });
        let entries = list_directory_blocking(session, source_uri, source_path, false)
            .map_err(FileOperationError::from)?;
        for entry in entries {
            let child_source_path = join_remote(source_path, &entry.name);
            let child_source_uri = ResourceUri::from_remote_profile(
                "sftp",
                source_uri.remote_authority().unwrap(),
                &child_source_path,
            )
            .map_err(FileOperationError::from)?;
            walk_remote_to_local(
                vfs,
                session,
                &child_source_uri,
                &child_source_path,
                &child_dest,
                &child_dest_uri,
                items,
            )?;
        }
    } else {
        let name = source_path
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or("file");
        let child_dest = dest_dir.join(name);
        let child_dest_uri =
            ResourceUri::from_local_path(&child_dest).map_err(FileOperationError::from)?;
        items.push(vfs::FileOperationItem {
            source: Some(source_uri.clone()),
            destination: Some(child_dest_uri),
            kind: FileKind::File,
            size: vfs.file_size(source_uri).ok(),
            recursive: false,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{cross_scheme_transfer_for, CrossSchemeTransfer};
    use vfs::ResourceUri;

    #[test]
    fn cross_scheme_transfer_catalog_allows_only_local_sftp_pairs() {
        let local = ResourceUri::parse("local:///tmp/source.txt").unwrap();
        let sftp = ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/tmp/source.txt")
            .unwrap();
        let smb = ResourceUri::parse("smb://550e8400-e29b-41d4-a716-446655440000/share/source.txt")
            .unwrap();

        assert_eq!(
            cross_scheme_transfer_for(&local, &sftp).unwrap(),
            CrossSchemeTransfer::LocalToSftp
        );
        assert_eq!(
            cross_scheme_transfer_for(&sftp, &local).unwrap(),
            CrossSchemeTransfer::SftpToLocal
        );
        assert!(cross_scheme_transfer_for(&local, &smb).is_err());
        assert!(cross_scheme_transfer_for(&smb, &local).is_err());
    }
}
