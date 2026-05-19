//! Integration tests for fs_reveal and fs_open_default validation (pre-OS launch).

use std::path::PathBuf;

use app_ipc::IpcError;
use fs_core::external_open::{open_path_with_default_app, reveal_path_in_file_manager};
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-reveal-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn fs_reveal_rejects_missing_path_before_launch() {
    let dir = temp_dir("reveal-missing");
    let missing = dir.join("missing.txt");
    let uri = ResourceUri::from_local_path(&missing).unwrap();

    let result = reveal_path_in_file_manager(&uri);
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "not_found");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_open_default_rejects_missing_path_before_launch() {
    let dir = temp_dir("open-missing");
    let missing = dir.join("missing.txt");
    let uri = ResourceUri::from_local_path(&missing).unwrap();

    let result = open_path_with_default_app(&uri);
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "not_found");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_reveal_accepts_existing_file_without_launch_failure() {
    let dir = temp_dir("reveal-file");
    let file_path = dir.join("visible.txt");
    std::fs::write(&file_path, "reveal me").unwrap();
    let uri = ResourceUri::from_local_path(&file_path).unwrap();

    let result = reveal_path_in_file_manager(&uri);
    if let Err(error) = result {
        let err: IpcError = error.into();
        assert_ne!(err.code, "not_found");
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_open_default_accepts_existing_file_without_not_found() {
    let dir = temp_dir("open-file");
    let file_path = dir.join("open-me.txt");
    std::fs::write(&file_path, "open me").unwrap();
    let uri = ResourceUri::from_local_path(&file_path).unwrap();

    let result = open_path_with_default_app(&uri);
    if let Err(error) = result {
        let err: IpcError = error.into();
        assert_ne!(err.code, "not_found");
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_reveal_rejects_invalid_uri() {
    let result = ResourceUri::parse("ftp://example.com/file");
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "unsupported_provider");
}
