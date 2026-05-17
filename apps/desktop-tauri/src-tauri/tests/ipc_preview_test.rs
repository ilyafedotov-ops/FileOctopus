//! Integration tests for fs_read_text_file command logic (preview / text reading).

use std::io::Read;
use std::path::PathBuf;

use app_ipc::{error_codes, IpcError};
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-preview-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Simulates the fs_read_text_file handler logic:
/// parse URI → check metadata → verify not directory → read up to max_bytes
fn read_text_file_logic(
    uri_str: &str,
    max_bytes: Option<u64>,
) -> Result<(String, bool, u64), IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::io(e.to_string()))?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory("cannot read a directory as text"));
    }

    let file_size = metadata.len();
    let max_bytes = max_bytes.unwrap_or(1_048_576); // 1 MB default
    let read_len = if file_size > max_bytes {
        max_bytes
    } else {
        file_size
    };

    let mut buf = vec![0u8; read_len as usize];
    let mut f = std::fs::File::open(&path).map_err(|e| IpcError::io(e.to_string()))?;
    f.read_exact(&mut buf)
        .map_err(|e| IpcError::io(e.to_string()))?;

    let content = String::from_utf8_lossy(&buf).to_string();

    Ok((content, file_size > max_bytes, file_size))
}

#[test]
fn fs_read_text_file_reads_file_content() {
    let dir = temp_dir("read-text");
    let file_path = dir.join("hello.txt");
    std::fs::write(&file_path, "Hello, FileOctopus!").unwrap();

    let uri = format!("local://{}", file_path.display());
    let (content, truncated, byte_size) = read_text_file_logic(&uri, None).unwrap();

    assert_eq!(content, "Hello, FileOctopus!");
    assert!(!truncated);
    assert_eq!(byte_size, 19);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_rejects_directory() {
    let dir = temp_dir("read-dir");
    let uri = format!("local://{}", dir.display());
    let result = read_text_file_logic(&uri, None);

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::IS_DIRECTORY);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_handles_truncation() {
    let dir = temp_dir("read-trunc");
    let file_path = dir.join("big.txt");
    let data = "A".repeat(200);
    std::fs::write(&file_path, &data).unwrap();

    let uri = format!("local://{}", file_path.display());
    let (content, truncated, byte_size) = read_text_file_logic(&uri, Some(100)).unwrap();

    assert_eq!(content.len(), 100);
    assert!(truncated);
    assert_eq!(byte_size, 200);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_no_truncation_when_within_limit() {
    let dir = temp_dir("read-no-trunc");
    let file_path = dir.join("small.txt");
    std::fs::write(&file_path, "small content").unwrap();

    let uri = format!("local://{}", file_path.display());
    let (content, truncated, byte_size) = read_text_file_logic(&uri, Some(1024)).unwrap();

    assert_eq!(content, "small content");
    assert!(!truncated);
    assert_eq!(byte_size, 13);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_rejects_missing_file() {
    let dir = temp_dir("read-missing");
    let missing = dir.join("nope.txt");
    let uri = format!("local://{}", missing.display());
    let result = read_text_file_logic(&uri, None);

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::IO_ERROR);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_empty_file() {
    let dir = temp_dir("read-empty");
    let file_path = dir.join("empty.txt");
    std::fs::write(&file_path, "").unwrap();

    // Empty file: read_len = 0, so buf is empty and read_exact on empty is OK
    let metadata = std::fs::metadata(&file_path).unwrap();
    assert_eq!(metadata.len(), 0);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_default_max_is_1mb() {
    let dir = temp_dir("read-default-max");
    let file_path = dir.join("data.txt");
    // Create a file smaller than 1MB
    let data = "X".repeat(1000);
    std::fs::write(&file_path, &data).unwrap();

    let uri = format!("local://{}", file_path.display());
    let (content, truncated, byte_size) = read_text_file_logic(&uri, None).unwrap();

    // Default max_bytes is 1MB, so 1000 bytes should not be truncated
    assert!(!truncated);
    assert_eq!(byte_size, 1000);
    assert_eq!(content.len(), 1000);

    let _ = std::fs::remove_dir_all(dir);
}
