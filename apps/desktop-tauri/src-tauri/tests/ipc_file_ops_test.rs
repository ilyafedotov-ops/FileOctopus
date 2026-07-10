//! Integration tests for fs_stat behavior.

use std::path::PathBuf;

use app_core::AppCore;
use app_ipc::IpcError;
use vfs::{FileKind, ResourceUri};

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-fileops-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn fs_stat_returns_entry_metadata_via_vfs() {
    let dir = temp_dir("stat");
    let file_path = dir.join("stat-me.txt");
    std::fs::write(&file_path, "stat content").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let entry = rt.block_on(async { state.vfs().stat(&uri).await }).unwrap();

    assert_eq!(entry.name, "stat-me.txt");
    assert_eq!(entry.size, Some(12));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_stat_rejects_nonexistent_path() {
    let dir = temp_dir("stat-missing");
    let file_path = dir.join("nope.txt");
    let uri = ResourceUri::from_local_path(&file_path).unwrap();

    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let result = rt.block_on(async { state.vfs().stat(&uri).await });

    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "not_found");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_stat_directory_returns_directory_kind() {
    let dir = temp_dir("stat-dir");
    let sub = dir.join("my-folder");
    std::fs::create_dir_all(&sub).unwrap();

    let uri = ResourceUri::from_local_path(&sub).unwrap();
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let entry = rt.block_on(async { state.vfs().stat(&uri).await }).unwrap();

    assert_eq!(entry.kind, FileKind::Directory);

    let _ = std::fs::remove_dir_all(dir);
}
