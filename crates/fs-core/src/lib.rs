use std::collections::HashMap;
use std::fs::{self, Metadata};
use std::io;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use vfs::{
    DirectoryBatch, DirectorySink, EntryCapabilities, FileEntry, FileKind, ListOptions,
    ProviderCapabilities, ProviderId, ResourceUri, VfsError, VfsProvider,
};

pub mod direct_ops;
pub mod external_open;
pub mod file_ops;
pub mod locations;
pub mod metadata;
pub mod search;
pub mod vfs_io;

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

    fn entry_for_path(
        path: &Path,
        uri: ResourceUri,
        metadata: Metadata,
        owner_cache: &mut OwnerLookupCache,
    ) -> FileEntry {
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
            permissions: permissions_string(&metadata),
            owner: owner_string(&metadata, owner_cache),
        }
    }

    fn stat_blocking(uri: ResourceUri) -> Result<FileEntry, VfsError> {
        let path = uri.to_local_path()?;
        let metadata =
            fs::symlink_metadata(&path).map_err(|error| Self::map_io_error(&uri, error))?;
        let mut owner_cache = OwnerLookupCache::default();

        Ok(Self::entry_for_path(&path, uri, metadata, &mut owner_cache))
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
        ProviderCapabilities::read_write()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
        let uri = uri.clone();

        tokio::task::spawn_blocking(move || Self::stat_blocking(uri))
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
    }

    async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let path = uri.to_local_path()?;
        let uri = uri.clone();
        tokio::task::spawn_blocking(move || fs::create_dir_all(&path))
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
            .map_err(|error| Self::map_io_error(&uri, error))
    }

    async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let path = uri.to_local_path()?;
        let uri = uri.clone();
        tokio::task::spawn_blocking(move || {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::File::create(&path).map(|_| ())
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
        .map_err(|error| Self::map_io_error(&uri, error))
    }

    async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
        let from_path = from.to_local_path()?;
        let to_path = to.to_local_path()?;
        let uri = from.clone();
        tokio::task::spawn_blocking(move || fs::rename(&from_path, &to_path))
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
            .map_err(|error| Self::map_io_error(&uri, error))
    }

    async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
        let path = uri.to_local_path()?;
        let uri = uri.clone();
        tokio::task::spawn_blocking(move || {
            let metadata = fs::symlink_metadata(&path)?;
            if metadata.is_dir() {
                if recursive {
                    fs::remove_dir_all(&path)
                } else {
                    fs::remove_dir(&path)
                }
            } else {
                fs::remove_file(&path)
            }
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
        .map_err(|error| Self::map_io_error(&uri, error))
    }

    async fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        mut on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        use std::io::{Read, Write};

        const CHUNK: usize = 64 * 1024;
        let from = source.to_local_path()?;
        let to = destination.to_local_path()?;
        let uri = source.clone();
        tokio::task::spawn_blocking(move || -> Result<u64, io::Error> {
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut reader = fs::File::open(&from)?;
            let mut writer = fs::File::create(&to)?;
            let mut buffer = vec![0_u8; CHUNK];
            let mut total = 0_u64;
            loop {
                let read = reader.read(&mut buffer)?;
                if read == 0 {
                    break;
                }
                writer.write_all(&buffer[..read])?;
                total += read as u64;
                on_progress(total);
            }
            writer.flush()?;
            Ok(total)
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
        .map_err(|error| Self::map_io_error(&uri, error))
    }

    async fn read_file_prefix(
        &self,
        uri: &ResourceUri,
        max_bytes: u64,
    ) -> Result<Vec<u8>, VfsError> {
        use std::io::Read;
        let path = uri.to_local_path()?;
        let uri = uri.clone();
        tokio::task::spawn_blocking(move || -> Result<Vec<u8>, io::Error> {
            let mut file = fs::File::open(&path)?;
            let mut buffer = vec![0_u8; max_bytes as usize];
            let read = file.read(&mut buffer)?;
            buffer.truncate(read);
            Ok(buffer)
        })
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
        .map_err(|error| Self::map_io_error(&uri, error))
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
    let mut owner_cache = OwnerLookupCache::default();
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
            &mut owner_cache,
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

#[cfg(unix)]
fn permissions_string(metadata: &Metadata) -> Option<String> {
    use std::os::unix::fs::PermissionsExt;
    let mode = metadata.permissions().mode();
    // Build rwxrwxrwx string
    let mut s = String::with_capacity(9);
    for offset in [6u32, 3, 0] {
        let bits = (mode >> offset) & 0o7;
        s.push(if bits & 4 != 0 { 'r' } else { '-' });
        s.push(if bits & 2 != 0 { 'w' } else { '-' });
        s.push(if bits & 1 != 0 { 'x' } else { '-' });
    }
    Some(s)
}

#[cfg(not(unix))]
fn permissions_string(_metadata: &Metadata) -> Option<String> {
    None
}

#[cfg(unix)]
#[derive(Default)]
struct OwnerLookupCache {
    names: HashMap<u32, Option<String>>,
}

#[cfg(not(unix))]
#[derive(Default)]
struct OwnerLookupCache;

#[cfg(unix)]
impl OwnerLookupCache {
    fn owner_for_uid(&mut self, uid: u32) -> Option<String> {
        self.owner_for_uid_with(uid, resolve_owner_name)
    }

    fn owner_for_uid_with<F>(&mut self, uid: u32, resolver: F) -> Option<String>
    where
        F: FnOnce(u32) -> Option<String>,
    {
        if let Some(cached) = self.names.get(&uid) {
            return cached.clone();
        }

        let owner = resolver(uid)
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| uid.to_string());
        self.names.insert(uid, Some(owner.clone()));
        Some(owner)
    }
}

#[cfg(unix)]
fn owner_string(metadata: &Metadata, owner_cache: &mut OwnerLookupCache) -> Option<String> {
    use std::os::unix::fs::MetadataExt;
    owner_cache.owner_for_uid(metadata.uid())
}

#[cfg(unix)]
fn resolve_owner_name(uid: u32) -> Option<String> {
    match std::process::Command::new("id")
        .args(["-nu", &uid.to_string()])
        .output()
    {
        Ok(output) if output.status.success() => {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (!name.is_empty()).then_some(name)
        }
        _ => None,
    }
}

#[cfg(not(unix))]
fn owner_string(_metadata: &Metadata, _owner_cache: &mut OwnerLookupCache) -> Option<String> {
    None
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn owner_lookup_cache_resolves_each_uid_once() {
        let mut cache = OwnerLookupCache::default();
        let mut calls = 0;

        let first = cache.owner_for_uid_with(1000, |_| {
            calls += 1;
            Some("alice".to_string())
        });
        let second = cache.owner_for_uid_with(1000, |_| {
            calls += 1;
            Some("alice".to_string())
        });

        assert_eq!(first.as_deref(), Some("alice"));
        assert_eq!(second.as_deref(), Some("alice"));
        assert_eq!(calls, 1, "owner lookup should be cached per uid");
    }
}
