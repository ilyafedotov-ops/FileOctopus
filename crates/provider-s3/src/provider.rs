use std::sync::Arc;

use remote_core::{run_blocking_io, ConnectionSessionManager};
use vfs::{
    DirectoryBatch, DirectorySink, FileKind, ListOptions, ProviderCapabilities, ProviderId,
    ResourceUri, VfsError, VfsProvider,
};

use crate::connector::{parse_bucket_key, S3Session};
use crate::ops::{dir_entry, object_entry, s3_bucket_from_uri_path, s3_prefix_from_uri_path};

pub struct S3Provider {
    sessions: Arc<ConnectionSessionManager>,
}

impl S3Provider {
    pub fn new(sessions: Arc<ConnectionSessionManager>) -> Self {
        Self { sessions }
    }

    fn profile_id_for_uri(uri: &ResourceUri) -> Result<String, VfsError> {
        uri.remote_authority()
            .map(str::to_string)
            .ok_or_else(|| VfsError::invalid_uri(uri.as_str(), "missing s3 profile id"))
    }

    async fn session_for(&self, uri: &ResourceUri) -> Result<(String, S3Session), VfsError> {
        let profile_id = Self::profile_id_for_uri(uri)?;
        let s3_session = self
            .sessions
            .typed_session_for(&profile_id, "s3", S3Session::clone_handle)
            .await
            .map_err(VfsError::from)?;
        Ok((profile_id, s3_session))
    }
}

fn remove_s3_tree_blocking(
    session: &S3Session,
    _uri: &ResourceUri,
    prefix: &str,
) -> Result<(), VfsError> {
    let bucket = session.client();
    let rt = tokio::runtime::Handle::current();

    let mut continuation_token = None;
    loop {
        let list_result = rt
            .block_on(bucket.list_page(
                prefix.to_string(),
                None,
                continuation_token,
                None,
                Some(1000),
            ))
            .map_err(|e| VfsError::internal(&format!("s3 list failed: {e}")))?;

        for obj in &list_result.contents {
            rt.block_on(bucket.delete_object(&obj.key))
                .map_err(|e| VfsError::internal(&format!("s3 delete failed: {e}")))?;
        }

        if !list_result.is_truncated {
            break;
        }
        continuation_token = list_result.next_continuation_token;
        if continuation_token.is_none() {
            return Err(VfsError::internal(
                "s3 list response was truncated without a continuation token",
            ));
        }
    }

    Ok(())
}

#[async_trait::async_trait]
impl VfsProvider for S3Provider {
    fn id(&self) -> ProviderId {
        ProviderId::new("s3")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["s3"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_write()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<vfs::FileEntry, VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let uri_path = uri.remote_path().unwrap_or_default();
        let bucket_name = s3_bucket_from_uri_path(&uri_path);
        let key = {
            let (_, k) = parse_bucket_key(&uri_path);
            k
        };

        if key.is_empty() || key.ends_with('/') {
            // This is a "directory" — just return a synthetic dir entry
            let name = if key.is_empty() {
                bucket_name.clone()
            } else {
                key.trim_end_matches('/')
                    .rsplit('/')
                    .next()
                    .unwrap_or(&key)
                    .to_string()
            };
            return Ok(vfs::FileEntry {
                uri: uri.clone(),
                name,
                extension: None,
                kind: FileKind::Directory,
                size: None,
                modified_at: None,
                created_at: None,
                accessed_at: None,
                is_hidden: false,
                is_symlink: false,
                is_placeholder: false,
                symlink_target: None,
                provider_id: ProviderId::new("s3"),
                capabilities: vfs::EntryCapabilities::writable_directory(),
                permissions: None,
                owner: None,
            });
        }

        // Try head_object
        let head_result = session.client().head_object(&key).await;
        match head_result {
            Ok(head) => {
                let name = key.rsplit('/').next().unwrap_or(&key).to_string();
                let extension = name
                    .rsplit('.')
                    .next()
                    .filter(|part| *part != name)
                    .map(str::to_string);
                let modified_at = head
                    .last_modified
                    .as_deref()
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| {
                        chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
                            dt.naive_utc(),
                            chrono::Utc,
                        )
                    });

                self.sessions.touch_session(&profile_id).await;
                Ok(vfs::FileEntry {
                    uri: uri.clone(),
                    name,
                    extension,
                    kind: FileKind::File,
                    size: head.content_length,
                    modified_at,
                    created_at: None,
                    accessed_at: None,
                    is_hidden: false,
                    is_symlink: false,
                    is_placeholder: false,
                    symlink_target: None,
                    provider_id: ProviderId::new("s3"),
                    capabilities: vfs::EntryCapabilities::writable_file(),
                    permissions: None,
                    owner: None,
                })
            }
            Err(_) => {
                // Maybe it's a "directory" (common prefix)
                let prefix = format!("{key}/");
                let list_result = session
                    .client()
                    .list_page(prefix, Some("/".to_string()), None, None, Some(1))
                    .await;
                match list_result {
                    Ok(result)
                        if !result.contents.is_empty() || !result.common_prefixes.is_empty() =>
                    {
                        let name = key.rsplit('/').next().unwrap_or(&key).to_string();
                        self.sessions.touch_session(&profile_id).await;
                        Ok(vfs::FileEntry {
                            uri: uri.clone(),
                            name,
                            extension: None,
                            kind: FileKind::Directory,
                            size: None,
                            modified_at: None,
                            created_at: None,
                            accessed_at: None,
                            is_hidden: false,
                            is_symlink: false,
                            is_placeholder: false,
                            symlink_target: None,
                            provider_id: ProviderId::new("s3"),
                            capabilities: vfs::EntryCapabilities::writable_directory(),
                            permissions: None,
                            owner: None,
                        })
                    }
                    _ => Err(VfsError::not_found(uri)),
                }
            }
        }
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let uri_path = uri.remote_path().unwrap_or_default();
        let prefix = s3_prefix_from_uri_path(&uri_path);

        let include_hidden = options.include_hidden;
        let batch_size = options.batch_size.max(1);
        let cancel = options.cancel.clone();

        let mut continuation_token: Option<String> = None;
        let mut batch_index = 0_u64;

        loop {
            if cancel.is_cancelled() {
                return Err(VfsError::cancelled(uri));
            }

            let result = session
                .client()
                .list_page(
                    prefix.clone(),
                    Some("/".to_string()),
                    continuation_token.clone(),
                    None,
                    Some(batch_size),
                )
                .await
                .map_err(|e| VfsError::internal(&format!("s3 list_page failed: {e}")))?;

            let mut entries = Vec::with_capacity(batch_size);
            for cp in &result.common_prefixes {
                let dir_name = cp
                    .prefix
                    .trim_end_matches('/')
                    .rsplit('/')
                    .next()
                    .unwrap_or("")
                    .to_string();
                if !include_hidden && dir_name.starts_with('.') {
                    continue;
                }
                let child_uri = ResourceUri::from_remote_profile(
                    "s3",
                    &profile_id,
                    &format!("/{}/{}", s3_bucket_from_uri_path(&uri_path), cp.prefix),
                )?;
                entries.push(dir_entry(&child_uri, &profile_id, &cp.prefix)?);
            }

            for obj in &result.contents {
                let obj_key = &obj.key;
                if obj_key == &prefix
                    || obj_key.ends_with('/')
                        && obj_key.trim_end_matches('/') == prefix.trim_end_matches('/')
                {
                    continue;
                }
                let obj_name = obj_key
                    .trim_end_matches('/')
                    .rsplit('/')
                    .next()
                    .unwrap_or(obj_key)
                    .to_string();
                if !include_hidden && obj_name.starts_with('.') {
                    continue;
                }
                let child_uri = ResourceUri::from_remote_profile(
                    "s3",
                    &profile_id,
                    &format!("/{}/{}", s3_bucket_from_uri_path(&uri_path), obj_key),
                )?;
                entries.push(object_entry(
                    &child_uri,
                    &profile_id,
                    obj_key,
                    obj.size,
                    &obj.last_modified,
                )?);
            }

            let next_continuation_token = if result.is_truncated {
                Some(result.next_continuation_token.ok_or_else(|| {
                    VfsError::internal(
                        "s3 list response was truncated without a continuation token",
                    )
                })?)
            } else {
                None
            };

            entries.sort_by_key(|entry| entry.name.to_lowercase());
            if entries.is_empty() && !result.is_truncated {
                sink.send(DirectoryBatch {
                    session_id: options.session_id.clone(),
                    request_id: options.request_id.clone(),
                    uri: uri.clone(),
                    entries,
                    batch_index,
                    is_complete: true,
                    total_hint: None,
                })
                .await
                .map_err(|_| VfsError::internal("directory sink closed"))?;
            } else {
                let chunk_count = entries.len().div_ceil(batch_size);
                for (chunk_index, chunk) in entries.chunks(batch_size).enumerate() {
                    if cancel.is_cancelled() {
                        return Err(VfsError::cancelled(uri));
                    }
                    sink.send(DirectoryBatch {
                        session_id: options.session_id.clone(),
                        request_id: options.request_id.clone(),
                        uri: uri.clone(),
                        entries: chunk.to_vec(),
                        batch_index,
                        is_complete: !result.is_truncated && chunk_index + 1 == chunk_count,
                        total_hint: None,
                    })
                    .await
                    .map_err(|_| VfsError::internal("directory sink closed"))?;
                    batch_index += 1;
                }
            }

            match next_continuation_token {
                Some(token) => continuation_token = Some(token),
                None => break,
            }
        }

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let uri_path = uri.remote_path().unwrap_or_default();
        let (_, key) = parse_bucket_key(&uri_path);
        let dir_key = if key.ends_with('/') {
            key.to_string()
        } else {
            format!("{key}/")
        };

        // S3 "directories" are 0-byte objects ending with /
        session
            .client()
            .put_object(&dir_key, &[])
            .await
            .map_err(|e| VfsError::internal(&format!("s3 mkdir failed: {e}")))?;

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let uri_path = uri.remote_path().unwrap_or_default();
        let (_, key) = parse_bucket_key(&uri_path);

        session
            .client()
            .put_object(&key, &[])
            .await
            .map_err(|e| VfsError::internal(&format!("s3 create file failed: {e}")))?;

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
        let from_authority = Self::profile_id_for_uri(from)?;
        let to_authority = Self::profile_id_for_uri(to)?;
        if from_authority != to_authority {
            return Err(VfsError::UnsupportedOperation {
                scheme: "s3".to_string(),
                operation: "rename across profiles",
            });
        }

        let (profile_id, session) = self.session_for(from).await?;
        let from_path = from.remote_path().unwrap_or_default();
        let to_path = to.remote_path().unwrap_or_default();
        let (_, from_key) = parse_bucket_key(&from_path);
        let (_, to_key) = parse_bucket_key(&to_path);

        session
            .client()
            .copy_object(&from_key, &to_key)
            .await
            .map_err(|e| VfsError::internal(&format!("s3 copy_object failed: {e}")))?;

        session
            .client()
            .delete_object(&from_key)
            .await
            .map_err(|e| VfsError::internal(&format!("s3 delete_object failed: {e}")))?;

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
        let (profile_id, session) = self.session_for(uri).await?;
        let uri_path = uri.remote_path().unwrap_or_default();
        let (_, key) = parse_bucket_key(&uri_path);

        if recursive && !key.is_empty() {
            let prefix = if key.ends_with('/') {
                key.clone()
            } else {
                format!("{key}/")
            };
            let uri_clone = uri.clone();
            run_blocking_io(move || remove_s3_tree_blocking(&session, &uri_clone, &prefix)).await?;
        } else {
            session
                .client()
                .delete_object(&key)
                .await
                .map_err(|e| VfsError::internal(&format!("s3 delete failed: {e}")))?;
        }

        self.sessions.touch_session(&profile_id).await;
        Ok(())
    }

    async fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        _on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        let source_authority = Self::profile_id_for_uri(source)?;
        let dest_authority = Self::profile_id_for_uri(destination)?;
        if source_authority != dest_authority {
            return Err(VfsError::UnsupportedOperation {
                scheme: "s3".to_string(),
                operation: "copy_file across profiles",
            });
        }

        let (profile_id, session) = self.session_for(source).await?;
        let from_path = source.remote_path().unwrap_or_default();
        let to_path = destination.remote_path().unwrap_or_default();
        let (_, from_key) = parse_bucket_key(&from_path);
        let (_, to_key) = parse_bucket_key(&to_path);

        // Get source size for reporting
        let head = session
            .client()
            .head_object(&from_key)
            .await
            .map_err(|e| VfsError::internal(&format!("s3 head_object failed: {e}")))?;
        let size = head.content_length.unwrap_or(0) as u64;

        let content_type = head
            .content_type
            .unwrap_or_else(|| "application/octet-stream".to_string());
        // Note: copy_object_internal only takes 2 args in rust-s3 0.34
        let _ = content_type; // unused but kept for future upgrade
        session
            .client()
            .copy_object(&from_key, &to_key)
            .await
            .map_err(|e| VfsError::internal(&format!("s3 copy_object failed: {e}")))?;

        self.sessions.touch_session(&profile_id).await;
        Ok(size)
    }

    async fn read_file_prefix(
        &self,
        uri: &ResourceUri,
        max_bytes: u64,
    ) -> Result<Vec<u8>, VfsError> {
        if max_bytes == 0 {
            return Ok(Vec::new());
        }
        let (profile_id, session) = self.session_for(uri).await?;
        let uri_path = uri.remote_path().unwrap_or_default();
        let (_, key) = parse_bucket_key(&uri_path);

        let response = session
            .client()
            .get_object_range(&key, 0, Some(max_bytes.saturating_sub(1)))
            .await
            .map_err(|e| VfsError::internal(&format!("s3 get_object_range failed: {e}")))?;

        self.sessions.touch_session(&profile_id).await;
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn s3_prefix_extraction() {
        assert_eq!(s3_prefix_from_uri_path("/my-bucket"), "");
        assert_eq!(s3_prefix_from_uri_path("/my-bucket/"), "");
        assert_eq!(s3_prefix_from_uri_path("/my-bucket/docs/"), "docs/");
        assert_eq!(
            s3_prefix_from_uri_path("/my-bucket/docs/file.txt"),
            "docs/file.txt/"
        );
    }

    #[test]
    fn s3_bucket_extraction() {
        assert_eq!(s3_bucket_from_uri_path("/my-bucket"), "my-bucket");
        assert_eq!(
            s3_bucket_from_uri_path("/my-bucket/path/to/key"),
            "my-bucket"
        );
    }

    #[test]
    fn parse_bucket_key_test() {
        let (b, k) = parse_bucket_key("/my-bucket/docs/file.txt");
        assert_eq!(b, "my-bucket");
        assert_eq!(k, "docs/file.txt");

        let (b, k) = parse_bucket_key("/my-bucket");
        assert_eq!(b, "my-bucket");
        assert_eq!(k, "");
    }
}
