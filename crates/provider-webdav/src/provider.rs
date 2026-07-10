use std::io::{Read, Write};
use std::sync::Arc;

use remote_core::{run_blocking_io, ConnectionSessionManager};
use vfs::{
    DirectoryBatch, DirectorySink, EntryCapabilities, FileEntry, FileKind, ListOptions,
    ProviderCapabilities, ProviderId, ResourceUri, VfsError, VfsProvider,
};

use crate::client::{DavDepth, DavResource, WebDavClient, WebDavError, WriteCondition};
use crate::connector::WebDavSession;

const MAX_STAGED_UPLOAD_BYTES: u64 = 256 * 1024 * 1024;

pub struct WebDavProvider {
    sessions: WebDavSessions,
}

enum WebDavSessions {
    Managed(Arc<ConnectionSessionManager>),
    Fixed {
        profile_id: String,
        session: Box<WebDavSession>,
    },
}

impl WebDavProvider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self {
            sessions: WebDavSessions::Managed(sessions),
        }
    }

    #[doc(hidden)]
    pub fn with_client_for_tests(profile_id: String, client: WebDavClient) -> Self {
        Self {
            sessions: WebDavSessions::Fixed {
                session: Box::new(WebDavSession::new(
                    client,
                    profile_id.clone(),
                    "/".to_string(),
                )),
                profile_id,
            },
        }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        if uri.scheme() != "webdav" {
            return Err(VfsError::UnsupportedProvider {
                scheme: uri.scheme().to_string(),
            });
        }
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing WebDAV profile id"))
    }

    async fn session_for(&self, uri: &ResourceUri) -> Result<(String, WebDavSession), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let session = match &self.sessions {
            WebDavSessions::Managed(sessions) => sessions
                .typed_session_for(&profile_id, "webdav", WebDavSession::clone_handle)
                .await
                .map_err(VfsError::from)?,
            WebDavSessions::Fixed {
                profile_id: fixed_profile_id,
                session,
            } if fixed_profile_id == &profile_id => session.clone_handle(),
            WebDavSessions::Fixed { .. } => return Err(VfsError::connection_required(uri)),
        };
        Ok((profile_id, session))
    }

    fn path_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_path()
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing WebDAV path"))
    }

    async fn resource_for(client: &WebDavClient, path: &str) -> Result<DavResource, WebDavError> {
        let expected = comparable_path(path);
        let resources = client.propfind(path, DavDepth::Zero).await?;
        for resource in resources {
            if comparable_path(&client.href_path(&resource.href)?) == expected {
                return Ok(resource);
            }
        }
        Err(WebDavError::NotFound {
            url: client.url_for_path(path)?.to_string(),
        })
    }

    fn map_error(uri: &ResourceUri, error: WebDavError) -> VfsError {
        match error {
            WebDavError::Authentication { status, .. }
                if status == reqwest::StatusCode::FORBIDDEN =>
            {
                VfsError::permission_denied(uri)
            }
            WebDavError::Authentication { .. } => {
                VfsError::authentication_failed(uri, "server rejected the WebDAV credentials")
            }
            WebDavError::NotFound { .. } => VfsError::not_found(uri),
            WebDavError::Conflict { .. } => VfsError::destination_conflict(uri),
            WebDavError::Transport(error) if error.is_timeout() => VfsError::timeout(uri),
            WebDavError::Transport(error) => VfsError::connection_lost(uri, error.to_string()),
            other => VfsError::internal(&other.to_string()),
        }
    }

    async fn touch(&self, profile_id: &str) {
        if let WebDavSessions::Managed(sessions) = &self.sessions {
            sessions.touch_session(profile_id).await;
        }
    }
}

#[async_trait::async_trait]
impl VfsProvider for WebDavProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("webdav")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["webdav"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_write()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let path = Self::path_for_uri(uri)?;
        let resource = Self::resource_for(session.client(), &path)
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        let entry = entry_from_resource(session.client(), &profile_id, resource)?;
        self.touch(&profile_id).await;
        Ok(entry)
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let path = Self::path_for_uri(uri)?;
        let parent = comparable_path(&path);
        let resources = session
            .client()
            .propfind(&path, DavDepth::One)
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        let mut entries = Vec::new();
        for resource in resources {
            if options.cancel.is_cancelled() {
                return Err(VfsError::cancelled(uri));
            }
            let resource_path = session
                .client()
                .href_path(&resource.href)
                .map_err(|error| Self::map_error(uri, error))?;
            if comparable_path(&resource_path) == parent
                || parent_path(&resource_path).as_deref() != Some(parent.as_str())
            {
                continue;
            }
            let entry = entry_from_resource(session.client(), &profile_id, resource)?;
            if !options.include_hidden && entry.is_hidden {
                continue;
            }
            entries.push(entry);
        }
        entries.sort_by(|left, right| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.name.cmp(&right.name))
        });

        let batch_size = options.batch_size.max(1);
        if entries.is_empty() {
            sink.send(DirectoryBatch {
                session_id: options.session_id,
                request_id: options.request_id,
                uri: uri.clone(),
                entries,
                batch_index: 0,
                is_complete: true,
                total_hint: Some(0),
            })
            .await
            .map_err(|_| VfsError::internal("directory sink closed"))?;
        } else {
            let total = entries.len();
            for (batch_index, chunk) in entries.chunks(batch_size).enumerate() {
                if options.cancel.is_cancelled() {
                    return Err(VfsError::cancelled(uri));
                }
                sink.send(DirectoryBatch {
                    session_id: options.session_id.clone(),
                    request_id: options.request_id.clone(),
                    uri: uri.clone(),
                    entries: chunk.to_vec(),
                    batch_index: batch_index as u64,
                    is_complete: (batch_index + 1) * batch_size >= total,
                    total_hint: Some(total as u64),
                })
                .await
                .map_err(|_| VfsError::internal("directory sink closed"))?;
            }
        }
        self.touch(&profile_id).await;
        Ok(())
    }

    async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let path = Self::path_for_uri(uri)?;
        session
            .client()
            .mkcol(&path)
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        self.touch(&profile_id).await;
        Ok(())
    }

    async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let path = Self::path_for_uri(uri)?;
        session
            .client()
            .put_bytes(&path, Vec::new(), WriteCondition::CreateOnly)
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        self.touch(&profile_id).await;
        Ok(())
    }

    async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
        ensure_same_profile(from, to, "rename across profiles")?;
        let (profile_id, session) = self.session_for(from).await?;
        let from_path = Self::path_for_uri(from)?;
        let to_path = Self::path_for_uri(to)?;
        let source = Self::resource_for(session.client(), &from_path)
            .await
            .map_err(|error| Self::map_error(from, error))?;
        session
            .client()
            .move_resource(&from_path, &to_path, source.etag.as_deref(), false)
            .await
            .map_err(|error| Self::map_error(to, error))?;
        self.touch(&profile_id).await;
        Ok(())
    }

    async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let path = Self::path_for_uri(uri)?;
        let resource = Self::resource_for(session.client(), &path)
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        if resource.is_collection && !recursive {
            let parent = comparable_path(&path);
            let resources = session
                .client()
                .propfind(&path, DavDepth::One)
                .await
                .map_err(|error| Self::map_error(uri, error))?;
            for child in resources {
                let child_path = session
                    .client()
                    .href_path(&child.href)
                    .map_err(|error| Self::map_error(uri, error))?;
                if is_descendant_path(&child_path, &parent) {
                    return Err(VfsError::internal("WebDAV directory is not empty"));
                }
            }
        }
        session
            .client()
            .delete(&path, resource.etag.as_deref())
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        self.touch(&profile_id).await;
        Ok(())
    }

    async fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        mut on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        ensure_same_profile(source, destination, "copy_file across profiles")?;
        let (profile_id, session) = self.session_for(source).await?;
        let source_path = Self::path_for_uri(source)?;
        let destination_path = Self::path_for_uri(destination)?;
        let resource = Self::resource_for(session.client(), &source_path)
            .await
            .map_err(|error| Self::map_error(source, error))?;
        session
            .client()
            .copy_resource(
                &source_path,
                &destination_path,
                resource.etag.as_deref(),
                false,
            )
            .await
            .map_err(|error| Self::map_error(destination, error))?;
        let size = resource.content_length.unwrap_or(0);
        on_progress(size);
        self.touch(&profile_id).await;
        Ok(size)
    }

    async fn write_file_from_reader(
        &self,
        destination: &ResourceUri,
        reader: Box<dyn Read + Send>,
        on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        let (profile_id, session) = self.session_for(destination).await?;
        let path = Self::path_for_uri(destination)?;
        let condition = match Self::resource_for(session.client(), &path).await {
            Ok(resource) => resource
                .etag
                .map(WriteCondition::IfMatch)
                .unwrap_or(WriteCondition::Overwrite),
            Err(WebDavError::NotFound { .. }) => WriteCondition::CreateOnly,
            Err(error) => return Err(Self::map_error(destination, error)),
        };
        let (staged, total) = stage_upload(reader, on_progress).await?;
        session
            .client()
            .put_file(&path, staged, total, condition)
            .await
            .map_err(|error| Self::map_error(destination, error))?;
        self.touch(&profile_id).await;
        Ok(total)
    }

    async fn read_file_to_writer(
        &self,
        source: &ResourceUri,
        mut writer: Box<dyn Write + Send>,
        mut on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        let (profile_id, session) = self.session_for(source).await?;
        let path = Self::path_for_uri(source)?;
        let total = session
            .client()
            .get_to_writer(&path, writer.as_mut(), on_progress.as_mut())
            .await
            .map_err(|error| Self::map_error(source, error))?;
        self.touch(&profile_id).await;
        Ok(total)
    }

    async fn read_file_prefix(
        &self,
        uri: &ResourceUri,
        max_bytes: u64,
    ) -> Result<Vec<u8>, VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let path = Self::path_for_uri(uri)?;
        let bytes = session
            .client()
            .get_prefix(&path, max_bytes)
            .await
            .map_err(|error| Self::map_error(uri, error))?;
        self.touch(&profile_id).await;
        Ok(bytes)
    }
}

fn entry_from_resource(
    client: &WebDavClient,
    profile_id: &str,
    resource: DavResource,
) -> Result<FileEntry, VfsError> {
    let path = client
        .href_path(&resource.href)
        .map_err(|error| VfsError::internal(&error.to_string()))?;
    let uri = ResourceUri::from_remote_profile("webdav", profile_id, &path)?;
    let fallback_name = comparable_path(&path)
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .unwrap_or("/")
        .to_string();
    let name = resource
        .display_name
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_name);
    let kind = if resource.is_collection {
        FileKind::Directory
    } else {
        FileKind::File
    };
    let extension = if kind == FileKind::File && !name.starts_with('.') {
        name.rsplit_once('.')
            .filter(|(stem, extension)| !stem.is_empty() && !extension.is_empty())
            .map(|(_, extension)| extension.to_string())
    } else {
        None
    };
    Ok(FileEntry {
        uri,
        name: name.clone(),
        extension,
        kind,
        size: (!resource.is_collection)
            .then_some(resource.content_length)
            .flatten(),
        modified_at: resource.modified_at,
        created_at: resource.created_at,
        accessed_at: None,
        is_hidden: name.starts_with('.'),
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: ProviderId::new("webdav"),
        capabilities: if resource.is_collection {
            EntryCapabilities::writable_directory()
        } else {
            EntryCapabilities::writable_file()
        },
        permissions: None,
        owner: None,
    })
}

fn comparable_path(path: &str) -> String {
    if path == "/" {
        "/".to_string()
    } else {
        format!("/{}", path.trim_matches('/'))
    }
}

fn parent_path(path: &str) -> Option<String> {
    let path = comparable_path(path);
    if path == "/" {
        return None;
    }
    let parent = path
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    Some(if parent.is_empty() {
        "/".to_string()
    } else {
        parent.to_string()
    })
}

fn is_descendant_path(path: &str, parent: &str) -> bool {
    let path = comparable_path(path);
    if parent == "/" {
        path != "/"
    } else {
        path.strip_prefix(parent)
            .is_some_and(|suffix| suffix.starts_with('/'))
    }
}

fn ensure_same_profile(
    source: &ResourceUri,
    destination: &ResourceUri,
    operation: &'static str,
) -> Result<(), VfsError> {
    if WebDavProvider::profile_id_for_uri(source)?
        != WebDavProvider::profile_id_for_uri(destination)?
    {
        return Err(VfsError::UnsupportedOperation {
            scheme: "webdav".to_string(),
            operation,
        });
    }
    Ok(())
}

async fn stage_upload(
    reader: Box<dyn Read + Send>,
    on_progress: Box<dyn FnMut(u64) + Send>,
) -> Result<(std::fs::File, u64), VfsError> {
    run_blocking_io(move || stage_upload_blocking(reader, on_progress, MAX_STAGED_UPLOAD_BYTES))
        .await
}

fn stage_upload_blocking(
    mut reader: Box<dyn Read + Send>,
    mut on_progress: Box<dyn FnMut(u64) + Send>,
    limit: u64,
) -> Result<(std::fs::File, u64), VfsError> {
    let mut staged =
        tempfile::tempfile().map_err(|error| VfsError::internal(&error.to_string()))?;
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|error| VfsError::internal(&error.to_string()))?;
        if count == 0 {
            break;
        }
        total = total
            .checked_add(count as u64)
            .ok_or_else(|| VfsError::internal("WebDAV upload size overflow"))?;
        if total > limit {
            return Err(VfsError::internal(
                "WebDAV upload exceeds the staged upload limit",
            ));
        }
        staged
            .write_all(&buffer[..count])
            .map_err(|error| VfsError::internal(&error.to_string()))?;
        on_progress(total);
    }
    staged
        .flush()
        .map_err(|error| VfsError::internal(&error.to_string()))?;
    Ok((staged, total))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staged_upload_rejects_data_above_its_limit() {
        let reader = Box::new(std::io::repeat(0x5a).take(1024 * 1024 + 1));
        let error = stage_upload_blocking(reader, Box::new(|_| {}), 1024 * 1024).unwrap_err();
        assert_eq!(error.code(), "internal");
        assert!(format!("{error:?}").contains("staged upload limit"));
    }
}
