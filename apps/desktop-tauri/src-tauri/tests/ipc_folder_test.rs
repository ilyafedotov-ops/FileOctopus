//! Integration tests for fs_folder_size command logic.

use std::path::PathBuf;

use fs_core::metadata;
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-folder-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn fs_folder_size_calculates_total_bytes() {
    let dir = temp_dir("foldersize");
    std::fs::write(dir.join("f1.txt"), "12345").unwrap();
    std::fs::write(dir.join("f2.txt"), "67890").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let summary = metadata::calculate_folder_size(&uri).unwrap();

    assert!(summary.total_size >= 10);
    assert!(summary.file_count >= 2);
    assert!(!summary.incomplete);
    assert!(summary.warnings.is_empty());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_folder_size_empty_directory() {
    let dir = temp_dir("foldersize-empty");
    let sub = dir.join("empty-dir");
    std::fs::create_dir_all(&sub).unwrap();

    let uri = ResourceUri::from_local_path(&sub).unwrap();
    let summary = metadata::calculate_folder_size(&uri).unwrap();

    assert_eq!(summary.total_size, 0);
    assert_eq!(summary.file_count, 0);
    assert_eq!(summary.item_count, 0); // no items inside empty dir
    assert_eq!(summary.directory_count, 0); // no subdirs

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_folder_size_nested_directories() {
    let dir = temp_dir("foldersize-nested");
    let sub1 = dir.join("level1");
    let sub2 = sub1.join("level2");
    std::fs::create_dir_all(&sub2).unwrap();
    std::fs::write(dir.join("root.txt"), "aaa").unwrap();
    std::fs::write(sub1.join("mid.txt"), "bbbbb").unwrap();
    std::fs::write(sub2.join("deep.txt"), "ccccccc").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let summary = metadata::calculate_folder_size(&uri).unwrap();

    // root.txt=3, mid.txt=5, deep.txt=7 = 15 bytes total
    assert!(summary.total_size >= 15);
    assert!(summary.file_count >= 3);
    assert!(summary.directory_count >= 2); // level1 and level2

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_folder_size_on_file_returns_file_metadata() {
    let dir = temp_dir("foldersize-file");
    let file_path = dir.join("not-a-dir.txt");
    std::fs::write(&file_path, "content").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let result = metadata::calculate_folder_size(&uri);

    // calculate_folder_size on a file succeeds but reports file metadata
    assert!(result.is_ok());
    let summary = result.unwrap();
    assert_eq!(summary.total_size, 7); // "content" = 7 bytes
    assert_eq!(summary.file_count, 1);
    assert_eq!(summary.item_count, 1);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_folder_size_rejects_nonexistent_path() {
    let dir = temp_dir("foldersize-missing");
    let missing = dir.join("does-not-exist");

    let uri = ResourceUri::from_local_path(&missing).unwrap();
    let result = metadata::calculate_folder_size(&uri);

    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_folder_size_counts_hidden_files() {
    let dir = temp_dir("foldersize-hidden");
    std::fs::write(dir.join(".hidden"), "secret").unwrap();
    std::fs::write(dir.join("visible.txt"), "public").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let summary = metadata::calculate_folder_size(&uri).unwrap();

    // Both hidden and visible files should be counted
    assert!(summary.file_count >= 2);
    assert!(summary.total_size >= 12); // "secret" (6) + "public" (6) = 12

    let _ = std::fs::remove_dir_all(dir);
}
