//! Integration tests for fs_create_file, fs_delete_permanently, fs_stat commands.

use std::path::{Path, PathBuf};

use app_core::AppCore;
use app_ipc::IpcError;
use fs_core::sprint4;
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

fn local_uri(path: &Path) -> String {
    format!("local://{}", path.display())
}

#[test]
fn fs_create_file_creates_empty_file_in_temp_dir() {
    let dir = temp_dir("create-file");
    let file_path = dir.join("newfile.txt");
    let uri = ResourceUri::from_local_path(&file_path).unwrap();

    // Simulate fs_create_file handler logic
    let entry = sprint4::create_empty_file(&uri).unwrap();
    assert!(file_path.exists());
    assert_eq!(entry.name, "newfile.txt");
    assert_eq!(entry.size, Some(0));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_create_file_rejects_duplicate_path() {
    let dir = temp_dir("create-dup");
    let file_path = dir.join("exists.txt");
    std::fs::write(&file_path, "already here").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();

    let result = sprint4::create_empty_file(&uri);
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "destination_conflict");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_create_file_with_nested_path() {
    let dir = temp_dir("create-nested");
    let file_path = dir.join("subdir").join("deep.txt");

    // Parent directory must exist
    assert!(!file_path.parent().unwrap().exists());

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let result = sprint4::create_empty_file(&uri);
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "destination_missing");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_delete_permanently_removes_single_file() {
    let dir = temp_dir("delete-file");
    let file_path = dir.join("to-delete.txt");
    std::fs::write(&file_path, "bye").unwrap();
    assert!(file_path.exists());

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    sprint4::delete_permanently(&[uri]).unwrap();
    assert!(!file_path.exists());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_delete_permanently_removes_directory_with_contents() {
    let dir = temp_dir("delete-dir");
    let sub = dir.join("subdir");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("inner.txt"), "data").unwrap();

    let uri = ResourceUri::from_local_path(&sub).unwrap();
    sprint4::delete_permanently(&[uri]).unwrap();
    assert!(!sub.exists());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_delete_permanently_handles_multiple_uris() {
    let dir = temp_dir("delete-multi");
    let f1 = dir.join("a.txt");
    let f2 = dir.join("b.txt");
    std::fs::write(&f1, "aaa").unwrap();
    std::fs::write(&f2, "bbb").unwrap();

    let uri1 = ResourceUri::from_local_path(&f1).unwrap();
    let uri2 = ResourceUri::from_local_path(&f2).unwrap();
    sprint4::delete_permanently(&[uri1, uri2]).unwrap();

    assert!(!f1.exists());
    assert!(!f2.exists());

    let _ = std::fs::remove_dir_all(dir);
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
