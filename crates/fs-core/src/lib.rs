use std::fs::{self, Metadata};
use std::io;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use vfs::{
    DirectoryBatch, DirectorySink, EntryCapabilities, FileEntry, FileKind, ListOptions,
    ProviderCapabilities, ProviderId, ResourceUri, VfsError, VfsProvider,
};

pub mod file_ops;
pub mod sprint4;

#[derive(Debug, Default)]
pub struct LocalFsProvider;

impl LocalFsProvider {
    pub fn new() -> Self {
        Self
    }

    fn map_io_error(uri: &ResourceUri, error: io::Error) -> VfsError {
        match error.kind() {
            io::ErrorKind::NotFound => VfsError::not_found(uri),
            io::ErrorKind::PermissionDenied => VfsError::permission_denied(uri),
            _ => VfsError::internal(&error.to_string()),
        }
    }

    fn entry_for_path(path: &Path, uri: ResourceUri, metadata: Metadata) -> FileEntry {
        let file_type = metadata.file_type();
        let is_symlink = file_type.is_symlink();
        let kind = if is_symlink {
            FileKind::Symlink
        } else if metadata.is_dir() {
            FileKind::Directory
        } else if metadata.is_file() {
            FileKind::File
        } else {
            FileKind::Unknown
        };
        let name = path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| uri.display_path());
        let extension = path
            .extension()
            .map(|value| value.to_string_lossy().to_string());
        let capabilities = if kind == FileKind::Directory {
            EntryCapabilities::read_only_directory()
        } else {
            EntryCapabilities::read_only_file()
        };
        let symlink_target = if is_symlink {
            fs::read_link(path)
                .ok()
                .and_then(|target| absolute_symlink_target(path, target))
                .and_then(|target| ResourceUri::from_local_path(&target).ok())
        } else {
            None
        };

        FileEntry {
            uri,
            name,
            extension,
            kind,
            size: metadata.is_file().then_some(metadata.len()),
            modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
            created_at: metadata.created().ok().map(DateTime::<Utc>::from),
            accessed_at: metadata.accessed().ok().map(DateTime::<Utc>::from),
            is_hidden: is_hidden(path),
            is_symlink,
            symlink_target,
            provider_id: ProviderId::new("local"),
            capabilities,
        }
    }

    fn stat_blocking(uri: ResourceUri) -> Result<FileEntry, VfsError> {
        let path = uri.to_local_path()?;
        let metadata =
            fs::symlink_metadata(&path).map_err(|error| Self::map_io_error(&uri, error))?;

        Ok(Self::entry_for_path(&path, uri, metadata))
    }
}

#[async_trait::async_trait]
impl VfsProvider for LocalFsProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("local")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["local"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_only()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
        let uri = uri.clone();

        tokio::task::spawn_blocking(move || Self::stat_blocking(uri))
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let uri = uri.clone();

        tokio::task::spawn_blocking(move || list_blocking(uri, options, sink))
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
    }
}

fn list_blocking(
    uri: ResourceUri,
    options: ListOptions,
    sink: DirectorySink,
) -> Result<(), VfsError> {
    let path = uri.to_local_path()?;
    let batch_size = options.batch_size.max(1);
    let mut entries = Vec::with_capacity(batch_size);
    let mut batch_index = 0;
    let read_dir =
        fs::read_dir(&path).map_err(|error| LocalFsProvider::map_io_error(&uri, error))?;

    for entry in read_dir {
        if options.cancel.is_cancelled() {
            return Err(VfsError::cancelled(&uri));
        }

        let entry = entry.map_err(|error| LocalFsProvider::map_io_error(&uri, error))?;
        let entry_path = entry.path();

        if !options.include_hidden && is_hidden(&entry_path) {
            continue;
        }

        let entry_uri = ResourceUri::from_local_path(&entry_path)?;
        let metadata = entry
            .metadata()
            .or_else(|_| fs::symlink_metadata(&entry_path))
            .map_err(|error| LocalFsProvider::map_io_error(&entry_uri, error))?;

        entries.push(LocalFsProvider::entry_for_path(
            &entry_path,
            entry_uri,
            metadata,
        ));

        if entries.len() >= batch_size {
            if options.cancel.is_cancelled() {
                return Err(VfsError::cancelled(&uri));
            }

            send_batch(
                &sink,
                DirectoryBatch {
                    session_id: options.session_id.clone(),
                    request_id: options.request_id.clone(),
                    uri: uri.clone(),
                    entries,
                    batch_index,
                    is_complete: false,
                    total_hint: None,
                },
            )?;
            entries = Vec::with_capacity(batch_size);
            batch_index += 1;
        }
    }

    send_batch(
        &sink,
        DirectoryBatch {
            session_id: options.session_id,
            request_id: options.request_id,
            uri,
            entries,
            batch_index,
            is_complete: true,
            total_hint: None,
        },
    )
}

fn send_batch(sink: &DirectorySink, batch: DirectoryBatch) -> Result<(), VfsError> {
    sink.blocking_send(batch)
        .map_err(|_| VfsError::internal("directory sink closed"))
}

fn absolute_symlink_target(path: &Path, target: PathBuf) -> Option<PathBuf> {
    if target.is_absolute() {
        return Some(target);
    }

    path.parent().map(|parent| parent.join(target))
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .map(|value| value.to_string_lossy().starts_with('.'))
        .unwrap_or(false)
}
