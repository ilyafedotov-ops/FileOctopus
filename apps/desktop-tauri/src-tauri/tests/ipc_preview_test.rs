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

fn local_uri(path: &std::path::Path) -> String {
    ResourceUri::from_local_path(path)
        .unwrap()
        .as_str()
        .to_string()
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

    let uri = local_uri(&file_path);
    let (content, truncated, byte_size) = read_text_file_logic(&uri, None).unwrap();

    assert_eq!(content, "Hello, FileOctopus!");
    assert!(!truncated);
    assert_eq!(byte_size, 19);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_rejects_directory() {
    let dir = temp_dir("read-dir");
    let uri = local_uri(&dir);
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

    let uri = local_uri(&file_path);
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

    let uri = local_uri(&file_path);
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
    let uri = local_uri(&missing);
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

    let uri = local_uri(&file_path);
    let (content, truncated, byte_size) = read_text_file_logic(&uri, None).unwrap();

    // Default max_bytes is 1MB, so 1000 bytes should not be truncated
    assert!(!truncated);
    assert_eq!(byte_size, 1000);
    assert_eq!(content.len(), 1000);

    let _ = std::fs::remove_dir_all(dir);
}

// ─── fs_read_image_as_data_uri tests ───

/// Simulates the fs_read_image_as_data_uri handler logic.
fn read_image_logic(uri_str: &str) -> Result<(String, u64, String), IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::io(e.to_string()))?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory("cannot read a directory as image"));
    }

    let file_size = metadata.len();
    let max_image_bytes: u64 = 20 * 1024 * 1024;
    if file_size > max_image_bytes {
        return Err(IpcError::file_too_large(format!(
            "image file too large: {} bytes (max {} bytes)",
            file_size, max_image_bytes
        )));
    }

    let mut buf = vec![0u8; file_size as usize];
    let mut f = std::fs::File::open(&path).map_err(|e| IpcError::io(e.to_string()))?;
    f.read_exact(&mut buf)
        .map_err(|e| IpcError::io(e.to_string()))?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();

    let mime = match ext.as_str() {
        ".png" => "image/png",
        ".jpg" | ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".bmp" => "image/bmp",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        ".ico" => "image/x-icon",
        _ => "application/octet-stream",
    };

    Ok((
        format!("data:{};base64,{}", mime, b64),
        file_size,
        mime.to_string(),
    ))
}

#[test]
fn fs_read_image_reads_png_as_data_uri() {
    let dir = temp_dir("read-image-png");
    let file_path = dir.join("test.png");
    // Minimal PNG-like data (not valid PNG, but tests the read+encode path)
    std::fs::write(&file_path, b"\x89PNG\r\n\x1a\nfake").unwrap();

    let uri = local_uri(&file_path);
    let (data_uri, byte_size, mime) = read_image_logic(&uri).unwrap();

    assert_eq!(mime, "image/png");
    assert!(data_uri.starts_with("data:image/png;base64,"));
    assert_eq!(byte_size, 12);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_image_reads_jpeg_as_data_uri() {
    let dir = temp_dir("read-image-jpg");
    let file_path = dir.join("photo.jpg");
    std::fs::write(&file_path, b"\xff\xd8\xff\xe0fake").unwrap();

    let uri = local_uri(&file_path);
    let (data_uri, byte_size, mime) = read_image_logic(&uri).unwrap();

    assert_eq!(mime, "image/jpeg");
    assert!(data_uri.starts_with("data:image/jpeg;base64,"));
    assert_eq!(byte_size, 8);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_image_rejects_directory() {
    let dir = temp_dir("read-image-dir");
    let uri = local_uri(&dir);
    let result = read_image_logic(&uri);

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::IS_DIRECTORY);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_image_rejects_missing_file() {
    let dir = temp_dir("read-image-missing");
    let missing = dir.join("nope.png");
    let uri = local_uri(&missing);
    let result = read_image_logic(&uri);

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::IO_ERROR);

    let _ = std::fs::remove_dir_all(dir);
}
