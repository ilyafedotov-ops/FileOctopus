//! Integration tests for fs_compute_hash command logic.

use std::path::PathBuf;

use app_ipc::IpcError;
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-hash-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Simulates the fs_compute_hash handler logic:
/// parse URI → check metadata → verify not directory → compute sha256
fn compute_hash_logic(uri_str: &str) -> Result<String, IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;

    if metadata.is_dir() {
        return Err(IpcError {
            code: "is_directory".to_string(),
            message: "cannot compute hash for a directory".to_string(),
        });
    }

    let file_size = metadata.len();
    if file_size > 100 * 1024 * 1024 {
        return Err(IpcError {
            code: "file_too_large".to_string(),
            message: format!(
                "file too large for hash computation ({} bytes, max 100 MB)",
                file_size
            ),
        });
    }

    let hash = sha256::try_digest(&path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;

    Ok(hash)
}

#[test]
fn fs_compute_hash_produces_sha256_for_file() {
    let dir = temp_dir("hash-file");
    let file_path = dir.join("data.bin");
    std::fs::write(&file_path, b"test content").unwrap();

    let uri = format!("local://{}", file_path.display());
    let hash = compute_hash_logic(&uri).unwrap();

    assert_eq!(hash.len(), 64); // SHA-256 hex is 64 chars
    assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_rejects_directory() {
    let dir = temp_dir("hash-dir");
    let uri = format!("local://{}", dir.display());
    let result = compute_hash_logic(&uri);

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, "is_directory");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_rejects_missing_file() {
    let dir = temp_dir("hash-missing");
    let missing = dir.join("does-not-exist.bin");
    let uri = format!("local://{}", missing.display());
    let result = compute_hash_logic(&uri);

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, "io_error");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_deterministic() {
    let dir = temp_dir("hash-deterministic");
    let file_path = dir.join("same-content.bin");
    std::fs::write(&file_path, b"deterministic test data").unwrap();

    let uri = format!("local://{}", file_path.display());
    let hash1 = compute_hash_logic(&uri).unwrap();
    let hash2 = compute_hash_logic(&uri).unwrap();

    assert_eq!(hash1, hash2);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_empty_file() {
    let dir = temp_dir("hash-empty");
    let file_path = dir.join("empty.bin");
    std::fs::write(&file_path, b"").unwrap();

    let uri = format!("local://{}", file_path.display());
    let hash = compute_hash_logic(&uri).unwrap();

    // SHA-256 of empty string is well-known
    assert_eq!(
        hash,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_different_files_different_hashes() {
    let dir = temp_dir("hash-diff");
    let f1 = dir.join("a.bin");
    let f2 = dir.join("b.bin");
    std::fs::write(&f1, b"content A").unwrap();
    std::fs::write(&f2, b"content B").unwrap();

    let uri1 = format!("local://{}", f1.display());
    let uri2 = format!("local://{}", f2.display());
    let hash1 = compute_hash_logic(&uri1).unwrap();
    let hash2 = compute_hash_logic(&uri2).unwrap();

    assert_ne!(hash1, hash2);

    let _ = std::fs::remove_dir_all(dir);
}
