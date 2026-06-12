use std::fs::Metadata;
use std::path::Path;

use vfs::{FileOperationError, ResourceUri};

pub const SF_DATALESS: u32 = 0x4000_0000;
pub const FILE_ATTRIBUTE_OFFLINE: u32 = 0x0000_1000;
pub const FILE_ATTRIBUTE_RECALL_ON_OPEN: u32 = 0x0004_0000;
pub const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x0040_0000;

pub fn flags_indicate_placeholder(st_flags: u32) -> bool {
    st_flags & SF_DATALESS != 0
}

pub fn attributes_indicate_placeholder(attributes: u32) -> bool {
    attributes
        & (FILE_ATTRIBUTE_OFFLINE
            | FILE_ATTRIBUTE_RECALL_ON_OPEN
            | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
        != 0
}

#[cfg(target_os = "macos")]
pub fn is_placeholder_metadata(metadata: &Metadata) -> bool {
    use std::os::macos::fs::MetadataExt;
    flags_indicate_placeholder(metadata.st_flags())
}

#[cfg(windows)]
pub fn is_placeholder_metadata(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    attributes_indicate_placeholder(metadata.file_attributes())
}

#[cfg(not(any(target_os = "macos", windows)))]
pub fn is_placeholder_metadata(_metadata: &Metadata) -> bool {
    false
}

pub fn is_placeholder_path(path: &Path) -> bool {
    std::fs::symlink_metadata(path)
        .map(|metadata| is_placeholder_metadata(&metadata))
        .unwrap_or(false)
}

pub fn classify_timed_out_uri(uri: &ResourceUri, error: &std::io::Error) -> FileOperationError {
    match uri.to_local_path() {
        Ok(path) if is_placeholder_path(&path) => FileOperationError::CloudUnavailable {
            uri: uri.as_str().to_string(),
        },
        _ => FileOperationError::timeout(error.to_string()),
    }
}

pub fn classify_timed_out_path(path: &Path, error: &std::io::Error) -> FileOperationError {
    if is_placeholder_path(path) {
        let uri = ResourceUri::from_local_path(path)
            .map(|uri| uri.as_str().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());
        FileOperationError::CloudUnavailable { uri }
    } else {
        FileOperationError::timeout(error.to_string())
    }
}
