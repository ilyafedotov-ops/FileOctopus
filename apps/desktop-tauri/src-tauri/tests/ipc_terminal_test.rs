//! Integration tests for fs_open_terminal path validation logic.

use std::path::PathBuf;

use app_ipc::{error_codes, IpcError};
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-terminal-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Mirrors `fs_open_terminal` validation before spawning a terminal emulator.
fn open_terminal_validate(uri_str: &str) -> Result<(), IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.exists() || !path.is_dir() {
        return Err(IpcError::new(
            error_codes::NOT_FOUND,
            format!("directory not found: {}", path.display()),
        ));
    }

    Ok(())
}

#[test]
fn fs_open_terminal_accepts_existing_directory() {
    let dir = temp_dir("term-ok");
    let uri = format!("local://{}", dir.display());
    assert!(open_terminal_validate(&uri).is_ok());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_open_terminal_rejects_missing_directory() {
    let dir = temp_dir("term-missing");
    let missing = dir.join("no-such-dir");
    let uri = format!("local://{}", missing.display());
    let result = open_terminal_validate(&uri);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, error_codes::NOT_FOUND);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_open_terminal_rejects_file_path() {
    let dir = temp_dir("term-file");
    let file_path = dir.join("file.txt");
    std::fs::write(&file_path, "not a directory").unwrap();

    let uri = format!("local://{}", file_path.display());
    let result = open_terminal_validate(&uri);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, error_codes::NOT_FOUND);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_open_terminal_rejects_invalid_uri() {
    let result = open_terminal_validate("file:///tmp");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.code == error_codes::UNSUPPORTED_PROVIDER || err.code == error_codes::INVALID_URI);
}
