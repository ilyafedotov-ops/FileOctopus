use vfs::{EntryCapabilities, FileEntry, FileKind, ProviderId, ResourceUri, VfsError};

use crate::connector::parse_bucket_key;

/// Build a FileEntry for an S3 "directory" (common prefix)
pub fn dir_entry(
    uri: &ResourceUri,
    _profile_id: &str,
    prefix: &str,
) -> Result<FileEntry, VfsError> {
    let name = prefix
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(prefix)
        .to_string();

    Ok(FileEntry {
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
        capabilities: EntryCapabilities::writable_directory(),
        permissions: None,
        owner: None,
    })
}

/// Build a FileEntry for an S3 object
pub fn object_entry(
    uri: &ResourceUri,
    _profile_id: &str,
    key: &str,
    size: u64,
    last_modified: &str,
) -> Result<FileEntry, VfsError> {
    let name = key
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(key)
        .to_string();

    let extension = if !name.contains('.') || name.starts_with('.') {
        None
    } else {
        name.rsplit('.')
            .next()
            .filter(|part| *part != name)
            .map(str::to_string)
    };
    let modified_at = chrono::DateTime::parse_from_rfc3339(last_modified)
        .ok()
        .map(|dt| {
            chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt.naive_utc(), chrono::Utc)
        });

    Ok(FileEntry {
        uri: uri.clone(),
        name,
        extension,
        kind: FileKind::File,
        size: Some(size),
        modified_at,
        created_at: None,
        accessed_at: None,
        is_hidden: false,
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: ProviderId::new("s3"),
        capabilities: EntryCapabilities::writable_file(),
        permissions: None,
        owner: None,
    })
}

/// Compute the S3 prefix from a URI path: /bucket/path/to/dir/ → path/to/dir/
pub fn s3_prefix_from_uri_path(uri_path: &str) -> String {
    let path = uri_path.trim_start_matches('/');
    let (_, key) = parse_bucket_key(path);
    if key.is_empty() {
        String::new()
    } else if key.ends_with('/') {
        key
    } else {
        format!("{key}/")
    }
}

/// Compute the bucket name from a URI path: /bucket/path → bucket
pub fn s3_bucket_from_uri_path(uri_path: &str) -> String {
    let (bucket, _) = parse_bucket_key(uri_path);
    bucket
}
