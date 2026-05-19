use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use provider_sftp::{
    create_empty_file_blocking, download_file_blocking, list_directory_blocking, mkdir_blocking,
    remove_dir_blocking, remove_file_blocking, rename_blocking, stat_path_blocking,
    upload_file_blocking, SftpSession, TRANSFER_CHUNK_SIZE,
};
use remote_core::ConnectionSessionManager;
use vfs::{FileKind, FileOperationError, ResourceUri};

#[derive(Clone)]
pub struct VfsFilesystem {
    sessions: Option<Arc<ConnectionSessionManager>>,
}

impl VfsFilesystem {
    pub fn local_only() -> Self {
        Self { sessions: None }
    }

    pub fn with_sessions(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self {
            sessions: Some(sessions),
        }
    }

    pub fn validate_uri(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
        match uri.scheme() {
            "local" => {
                uri.to_local_path()?;
                Ok(())
            }
            scheme if vfs::REMOTE_SCHEMES.contains(&scheme) => {
                if self.sessions.is_none() {
                    return Err(FileOperationError::UnsupportedProvider {
                        scheme: scheme.to_string(),
                    });
                }
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

        let session = self.sftp_session(uri)?;
        let remote_path = remote_path(uri)?;
        let entry =
            stat_path_blocking(&session, uri, &remote_path).map_err(FileOperationError::from)?;
        Ok(entry.kind)
    }

    pub fn file_size(&self, uri: &ResourceUri) -> Result<u64, FileOperationError> {
        if uri.scheme() == "local" {
            let path = uri.to_local_path()?;
            let metadata = fs::metadata(&path).map_err(|error| map_local_io(uri, error))?;
            return Ok(metadata.len());
        }

        let session = self.sftp_session(uri)?;
        let remote_path = remote_path(uri)?;
        let entry =
            stat_path_blocking(&session, uri, &remote_path).map_err(FileOperationError::from)?;
        Ok(entry.size.unwrap_or(0))
    }

    pub fn mkdir(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
        if uri.scheme() == "local" {
            let path = uri.to_local_path()?;
            fs::create_dir_all(&path).map_err(|error| map_local_io(uri, error))?;
            return Ok(());
        }

        let session = self.sftp_session(uri)?;
        let remote_path = remote_path(uri)?;
        mkdir_blocking(&session, uri, &remote_path).map_err(FileOperationError::from)
    }

    pub fn create_empty_file(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
        if uri.scheme() == "local" {
            let path = uri.to_local_path()?;
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| map_local_io(uri, error))?;
            }
            File::create(&path).map_err(|error| map_local_io(uri, error))?;
            return Ok(());
        }

        let session = self.sftp_session(uri)?;
        let remote_path = remote_path(uri)?;
        create_empty_file_blocking(&session, uri, &remote_path).map_err(FileOperationError::from)
    }

    pub fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), FileOperationError> {
        if from.scheme() == "local" && to.scheme() == "local" {
            let from_path = from.to_local_path()?;
            let to_path = to.to_local_path()?;
            fs::rename(&from_path, &to_path).map_err(|error| map_local_io(from, error))?;
            return Ok(());
        }

        if from.scheme() == "sftp" && to.scheme() == "sftp" {
            let from_profile = from.remote_authority().ok_or_else(|| invalid_path(from))?;
            let to_profile = to.remote_authority().ok_or_else(|| invalid_path(to))?;
            if from_profile != to_profile {
                self.copy_file(from, to, |_| {})?;
                self.remove(from, true)?;
                return Ok(());
            }
            let session = self.sftp_session(from)?;
            rename_blocking(&session, from, &remote_path(from)?, &remote_path(to)?)
                .map_err(FileOperationError::from)?;
            return Ok(());
        }

        Err(FileOperationError::UnsupportedProvider {
            scheme: format!("{}->{}", from.scheme(), to.scheme()),
        })
    }

    pub fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), FileOperationError> {
        let kind = self.stat_kind(uri)?;
        match (uri.scheme(), kind) {
            ("local", FileKind::Directory) => {
                let path = uri.to_local_path()?;
                if recursive {
                    fs::remove_dir_all(&path).map_err(|error| map_local_io(uri, error))?;
                } else {
                    fs::remove_dir(&path).map_err(|error| map_local_io(uri, error))?;
                }
            }
            ("local", _) => {
                let path = uri.to_local_path()?;
                fs::remove_file(&path).map_err(|error| map_local_io(uri, error))?;
            }
            ("sftp", FileKind::Directory) => {
                let session = self.sftp_session(uri)?;
                let path = remote_path(uri)?;
                if recursive {
                    self.remove_sftp_tree(&session, uri, &path)?;
                } else {
                    remove_dir_blocking(&session, uri, &path).map_err(FileOperationError::from)?;
                }
            }
            ("sftp", _) => {
                let session = self.sftp_session(uri)?;
                remove_file_blocking(&session, uri, &remote_path(uri)?)
                    .map_err(FileOperationError::from)?;
            }
            (scheme, _) => {
                return Err(FileOperationError::UnsupportedProvider {
                    scheme: scheme.to_string(),
                });
            }
        }

        Ok(())
    }

    pub fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        mut on_progress: impl FnMut(u64),
    ) -> Result<u64, FileOperationError> {
        match (source.scheme(), destination.scheme()) {
            ("local", "local") => {
                let from = source.to_local_path()?;
                let to = destination.to_local_path()?;
                if let Some(parent) = to.parent() {
                    fs::create_dir_all(parent).map_err(|error| map_local_io(destination, error))?;
                }
                let bytes = fs::copy(&from, &to).map_err(|error| map_local_io(source, error))?;
                on_progress(bytes);
                Ok(bytes)
            }
            ("local", "sftp") => {
                let from = source.to_local_path()?;
                let session = self.sftp_session(destination)?;
                let dest_path = remote_path(destination)?;
                let file = File::open(&from).map_err(|error| map_local_io(source, error))?;
                upload_file_blocking(&session, destination, &dest_path, file, on_progress)
                    .map_err(FileOperationError::from)
            }
            ("sftp", "local") => {
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
            ("sftp", "sftp") => {
                let from_session = self.sftp_session(source)?;
                let to_session = self.sftp_session(destination)?;
                let from_path = remote_path(source)?;
                let to_path = remote_path(destination)?;
                let mut buffer = vec![0_u8; TRANSFER_CHUNK_SIZE];
                let mut total = 0_u64;
                {
                    let read_guard = from_session.lock_session().map_err(map_remote_error)?;
                    let read_sftp = read_guard.sftp().map_err(map_sftp_internal)?;
                    let mut reader = read_sftp
                        .open(Path::new(&from_path))
                        .map_err(|error| map_sftp_stat(source, error))?;
                    let write_guard = to_session.lock_session().map_err(map_remote_error)?;
                    let write_sftp = write_guard.sftp().map_err(map_sftp_internal)?;
                    let mut writer = write_sftp
                        .create(Path::new(&to_path))
                        .map_err(|error| map_sftp_stat(destination, error))?;
                    loop {
                        let read = reader
                            .read(&mut buffer)
                            .map_err(|error| FileOperationError::io(error.to_string()))?;
                        if read == 0 {
                            break;
                        }
                        writer
                            .write_all(&buffer[..read])
                            .map_err(|error| FileOperationError::io(error.to_string()))?;
                        total += read as u64;
                        on_progress(total);
                    }
                    writer
                        .flush()
                        .map_err(|error| FileOperationError::io(error.to_string()))?;
                }
                Ok(total)
            }
            (from, to) => Err(FileOperationError::UnsupportedProvider {
                scheme: format!("{from}->{to}"),
            }),
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

        if source.scheme() == "sftp" && destination_dir.scheme() == "sftp" {
            return self.collect_sftp_copy_items(source, destination_dir, warnings);
        }

        if source.scheme() == "local" && destination_dir.scheme() == "sftp" {
            return collect_local_to_remote_copy_items(self, source, destination_dir, warnings);
        }

        if source.scheme() == "sftp" && destination_dir.scheme() == "local" {
            return collect_remote_to_local_copy_items(self, source, destination_dir, warnings);
        }

        Err(FileOperationError::UnsupportedProvider {
            scheme: format!("{}->{}", source.scheme(), destination_dir.scheme()),
        })
    }

    fn collect_sftp_copy_items(
        &self,
        source: &ResourceUri,
        destination_dir: &ResourceUri,
        warnings: &mut Vec<vfs::FileOperationWarning>,
    ) -> Result<Vec<vfs::FileOperationItem>, FileOperationError> {
        let session = self.sftp_session(source)?;
        let source_path = remote_path(source)?;
        let dest_profile = destination_dir
            .remote_authority()
            .ok_or_else(|| invalid_path(destination_dir))?;
        let dest_base = remote_path(destination_dir)?;
        let mut items = Vec::new();
        self.walk_sftp_copy(
            &session,
            source,
            &source_path,
            dest_profile,
            &dest_base,
            &mut items,
            warnings,
        )?;
        Ok(items)
    }

    fn walk_sftp_copy(
        &self,
        session: &SftpSession,
        source_uri: &ResourceUri,
        source_path: &str,
        dest_profile: &str,
        dest_path: &str,
        items: &mut Vec<vfs::FileOperationItem>,
        warnings: &mut Vec<vfs::FileOperationWarning>,
    ) -> Result<(), FileOperationError> {
        let entries = list_directory_blocking(session, source_uri, source_path, false)
            .map_err(FileOperationError::from)?;
        let kind = self.stat_kind(source_uri)?;

        if kind == FileKind::Directory {
            let dest_uri = ResourceUri::from_remote_profile("sftp", dest_profile, dest_path)
                .map_err(FileOperationError::from)?;
            items.push(vfs::FileOperationItem {
                source: Some(source_uri.clone()),
                destination: Some(dest_uri),
                kind: FileKind::Directory,
                size: None,
                recursive: true,
            });

            for entry in entries {
                let child_source_path = join_remote(source_path, &entry.name);
                let child_dest_path = join_remote(dest_path, &entry.name);
                let child_source_uri = ResourceUri::from_remote_profile(
                    "sftp",
                    source_uri.remote_authority().unwrap(),
                    &child_source_path,
                )
                .map_err(FileOperationError::from)?;
                if entry.kind == FileKind::Directory {
                    self.walk_sftp_copy(
                        session,
                        &child_source_uri,
                        &child_source_path,
                        dest_profile,
                        &child_dest_path,
                        items,
                        warnings,
                    )?;
                } else if entry.kind == FileKind::File {
                    let child_dest_uri =
                        ResourceUri::from_remote_profile("sftp", dest_profile, &child_dest_path)
                            .map_err(FileOperationError::from)?;
                    items.push(vfs::FileOperationItem {
                        source: Some(child_source_uri),
                        destination: Some(child_dest_uri),
                        kind: FileKind::File,
                        size: entry.size,
                        recursive: false,
                    });
                }
            }
        } else {
            let dest_uri = ResourceUri::from_remote_profile("sftp", dest_profile, dest_path)
                .map_err(FileOperationError::from)?;
            items.push(vfs::FileOperationItem {
                source: Some(source_uri.clone()),
                destination: Some(dest_uri),
                kind: FileKind::File,
                size: self.file_size(source_uri).ok(),
                recursive: false,
            });
        }

        let _ = warnings;
        Ok(())
    }

    fn remove_sftp_tree(
        &self,
        session: &SftpSession,
        uri: &ResourceUri,
        path: &str,
    ) -> Result<(), FileOperationError> {
        let entries =
            list_directory_blocking(session, uri, path, true).map_err(FileOperationError::from)?;
        for entry in entries {
            let child_path = join_remote(path, &entry.name);
            let child_uri = ResourceUri::from_remote_profile(
                "sftp",
                uri.remote_authority().unwrap(),
                &child_path,
            )
            .map_err(FileOperationError::from)?;
            if entry.kind == FileKind::Directory {
                self.remove_sftp_tree(session, &child_uri, &child_path)?;
            } else {
                remove_file_blocking(session, &child_uri, &child_path)
                    .map_err(FileOperationError::from)?;
            }
        }
        remove_dir_blocking(session, uri, path).map_err(FileOperationError::from)
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
        _ => FileOperationError::io(error.to_string()),
    }
}

fn map_remote_error(error: remote_core::RemoteError) -> FileOperationError {
    FileOperationError::from(vfs::VfsError::from(error))
}

fn map_sftp_internal(error: impl std::fmt::Display) -> FileOperationError {
    FileOperationError::Internal {
        message: error.to_string(),
    }
}

fn map_sftp_stat(uri: &ResourceUri, error: impl std::fmt::Display) -> FileOperationError {
    FileOperationError::Internal {
        message: format!("{}: {}", error, uri.as_str()),
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
    vfs: &VfsFilesystem,
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
        walk_local_to_remote(
            vfs,
            &source_path,
            source,
            dest_profile,
            &dest_base,
            &mut items,
            warnings,
        )?;
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
    vfs: &VfsFilesystem,
    source_path: &Path,
    source_uri: &ResourceUri,
    dest_profile: &str,
    dest_path: &str,
    items: &mut Vec<vfs::FileOperationItem>,
    warnings: &mut Vec<vfs::FileOperationWarning>,
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
                vfs,
                &child_source_path,
                &child_source_uri,
                dest_profile,
                &child_dest_path,
                items,
                warnings,
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
    warnings: &mut Vec<vfs::FileOperationWarning>,
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
        warnings,
    )?;
    Ok(items)
}

fn walk_remote_to_local(
    vfs: &VfsFilesystem,
    session: &SftpSession,
    source_uri: &ResourceUri,
    source_path: &str,
    dest_dir: &Path,
    _dest_dir_uri: &ResourceUri,
    items: &mut Vec<vfs::FileOperationItem>,
    warnings: &mut Vec<vfs::FileOperationWarning>,
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
                warnings,
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
    let _ = warnings;
    Ok(())
}
