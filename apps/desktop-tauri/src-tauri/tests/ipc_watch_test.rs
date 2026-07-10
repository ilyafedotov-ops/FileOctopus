//! Integration tests for fs_watch_start / fs_watch_stop command logic.
//!
//! The watch handler depends on Tauri State + AppHandle, so we test
//! the core logic (URI validation, fingerprint comparison) directly.

use std::path::PathBuf;

use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-watch-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Simulates the folder_fingerprint logic from lib.rs.
fn folder_fingerprint(path: &PathBuf) -> Vec<(String, u64)> {
    let mut entries: Vec<(String, u64)> = std::fs::read_dir(path)
        .ok()
        .into_iter()
        .flat_map(|items| items.filter_map(Result::ok))
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            Some((
                entry.file_name().to_string_lossy().to_string(),
                metadata.len(),
            ))
        })
        .collect();
    entries.sort();
    entries
}

/// Simulates the URI validation from fs_watch_start handler.
fn validate_watch_uri(uri_str: &str) -> Result<PathBuf, String> {
    let uri = ResourceUri::parse(uri_str).map_err(|e| e.to_string())?;
    let path = uri.to_local_path().map_err(|e| e.to_string())?;
    if !path.is_dir() {
        return Err("folder_not_found: Choose an existing folder to watch.".to_string());
    }
    Ok(path)
}

#[test]
fn watch_accepts_valid_directory_uri() {
    let dir = temp_dir("valid-dir");
    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = validate_watch_uri(uri.as_str());
    assert!(result.is_ok());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn watch_rejects_file_uri() {
    let dir = temp_dir("file-uri");
    let file_path = dir.join("test.txt");
    std::fs::write(&file_path, b"hello").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let result = validate_watch_uri(uri.as_str());
    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn watch_rejects_nonexistent_path() {
    let dir = temp_dir("missing-path");
    let missing = dir.join("does-not-exist");
    let uri = ResourceUri::from_local_path(&missing).unwrap();
    let result = validate_watch_uri(uri.as_str());
    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn watch_rejects_invalid_uri_scheme() {
    let result = validate_watch_uri("file:///tmp/something");
    assert!(result.is_err());
}

#[test]
fn fingerprint_detects_new_file() {
    let dir = temp_dir("fp-new");
    let fp1 = folder_fingerprint(&dir);
    assert!(fp1.is_empty());

    std::fs::write(dir.join("added.txt"), b"new file").unwrap();
    let fp2 = folder_fingerprint(&dir);

    assert_ne!(fp1, fp2);
    assert_eq!(fp2.len(), 1);
    assert_eq!(fp2[0].0, "added.txt");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fingerprint_detects_file_removal() {
    let dir = temp_dir("fp-remove");
    std::fs::write(dir.join("temporary.txt"), b"temp").unwrap();
    let fp1 = folder_fingerprint(&dir);
    assert_eq!(fp1.len(), 1);

    std::fs::remove_file(dir.join("temporary.txt")).unwrap();
    let fp2 = folder_fingerprint(&dir);
    assert!(fp2.is_empty());
    assert_ne!(fp1, fp2);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fingerprint_detects_size_change() {
    let dir = temp_dir("fp-size");
    std::fs::write(dir.join("growing.log"), b"small").unwrap();
    let fp1 = folder_fingerprint(&dir);
    let size1 = fp1[0].1;

    std::fs::write(dir.join("growing.log"), b"much larger content now").unwrap();
    let fp2 = folder_fingerprint(&dir);
    let size2 = fp2[0].1;

    assert_ne!(size1, size2);
    assert!(size2 > size1);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fingerprint_stable_when_no_changes() {
    let dir = temp_dir("fp-stable");
    std::fs::write(dir.join("a.txt"), b"aaa").unwrap();
    std::fs::write(dir.join("b.txt"), b"bbb").unwrap();

    let fp1 = folder_fingerprint(&dir);
    let fp2 = folder_fingerprint(&dir);

    assert_eq!(fp1, fp2);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fingerprint_sorted_alphabetically() {
    let dir = temp_dir("fp-sorted");
    std::fs::write(dir.join("zebra.txt"), b"z").unwrap();
    std::fs::write(dir.join("alpha.txt"), b"a").unwrap();
    std::fs::write(dir.join("middle.txt"), b"m").unwrap();

    let fp = folder_fingerprint(&dir);
    let names: Vec<&str> = fp.iter().map(|(n, _)| n.as_str()).collect();
    assert_eq!(names, vec!["alpha.txt", "middle.txt", "zebra.txt"]);

    let _ = std::fs::remove_dir_all(dir);
}
