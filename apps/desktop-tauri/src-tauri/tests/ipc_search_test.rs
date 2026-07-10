//! Integration tests for fs_recursive_search command logic.

use std::path::PathBuf;

use fs_core::search::recursive_search;
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-search-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn recursive_search_finds_matching_file() {
    let dir = temp_dir("find-file");
    std::fs::write(dir.join("report.pdf"), b"pdf data").unwrap();
    std::fs::write(dir.join("notes.txt"), b"notes").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "report", 100).unwrap();

    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].name, "report.pdf");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_empty_query_returns_empty() {
    let dir = temp_dir("empty-query");
    std::fs::write(dir.join("file.txt"), b"data").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "", 100).unwrap();

    assert!(result.matches.is_empty());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_whitespace_only_query_returns_empty() {
    let dir = temp_dir("ws-query");
    std::fs::write(dir.join("file.txt"), b"data").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "   ", 100).unwrap();

    assert!(result.matches.is_empty());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_rejects_non_directory() {
    let dir = temp_dir("not-dir");
    let file_path = dir.join("afile.txt");
    std::fs::write(&file_path, b"hello").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let result = recursive_search(&uri, "anything", 100);

    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_case_insensitive() {
    let dir = temp_dir("case-insensitive");
    std::fs::write(dir.join("README.md"), b"readme").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "readme", 100).unwrap();

    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].name, "README.md");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_limit_enforced() {
    let dir = temp_dir("limit");
    for i in 0..20 {
        std::fs::write(dir.join(format!("doc_{i:02}.txt")), b"x").unwrap();
    }

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "doc", 5).unwrap();

    assert!(
        result.matches.len() <= 5,
        "expected at most 5 matches, got {}",
        result.matches.len()
    );

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_finds_in_subdirectory() {
    let dir = temp_dir("subdir");
    let sub = dir.join("nested");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("deep_file.txt"), b"deep").unwrap();
    std::fs::write(dir.join("top_file.txt"), b"top").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "deep", 100).unwrap();

    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].name, "deep_file.txt");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_no_match_returns_empty() {
    let dir = temp_dir("no-match");
    std::fs::write(dir.join("alpha.txt"), b"a").unwrap();
    std::fs::write(dir.join("beta.txt"), b"b").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "xyzzy_nonexistent", 100).unwrap();

    assert!(result.matches.is_empty());
    assert!(!result.incomplete);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recursive_search_match_has_correct_fields() {
    let dir = temp_dir("fields");
    std::fs::write(dir.join("target.csv"), b"1,2,3").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let result = recursive_search(&uri, "target", 100).unwrap();

    assert_eq!(result.matches.len(), 1);
    let m = &result.matches[0];
    assert_eq!(m.name, "target.csv");
    assert!(m.uri.starts_with("local://"));
    assert!(m.parent_uri.starts_with("local://"));
    assert!(m.size.is_some());
    assert!(m.modified_at.is_some());

    let _ = std::fs::remove_dir_all(dir);
}
