//! Integration tests for fs_sync_directories command logic.

use app_ipc::{IpcError, SyncDirectoriesRequest, SyncDirectoriesResponse, SyncEntryDto};
use fs_core::sync::{self, SyncComparison, SyncFileStatus};
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-sync-test-{}-{}",
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

/// Simulates the fs_sync_directories handler logic:
/// parse URIs → compare_directories → map to DTOs
fn sync_directories_logic(
    request: &SyncDirectoriesRequest,
) -> Result<SyncDirectoriesResponse, IpcError> {
    let left_uri = ResourceUri::parse(&request.left_uri).map_err(IpcError::from)?;
    let right_uri = ResourceUri::parse(&request.right_uri).map_err(IpcError::from)?;

    let comparison = match request.comparison.as_str() {
        "size" => SyncComparison::BySize,
        "date" => SyncComparison::ByDate,
        _ => SyncComparison::ByName,
    };

    let plan = sync::compare_directories(&left_uri, &right_uri, comparison, request.recursive)
        .map_err(IpcError::from)?;

    Ok(SyncDirectoriesResponse {
        left_uri: plan.left_uri,
        right_uri: plan.right_uri,
        recursive: plan.recursive,
        entries: plan
            .entries
            .into_iter()
            .map(|e| {
                let status = match e.status {
                    SyncFileStatus::OnlyLeft => "onlyLeft",
                    SyncFileStatus::OnlyRight => "onlyRight",
                    SyncFileStatus::Same => "same",
                    SyncFileStatus::NewerLeft => "newerLeft",
                    SyncFileStatus::NewerRight => "newerRight",
                    SyncFileStatus::Different => "different",
                };
                SyncEntryDto {
                    name: e.name,
                    left_uri: e.left_uri,
                    right_uri: e.right_uri,
                    left_size: e.left_size,
                    right_size: e.right_size,
                    left_modified: e.left_modified.map(|dt| dt.to_rfc3339()),
                    right_modified: e.right_modified.map(|dt| dt.to_rfc3339()),
                    left_is_dir: e.left_is_dir,
                    right_is_dir: e.right_is_dir,
                    status: status.to_string(),
                }
            })
            .collect(),
    })
}

#[test]
fn sync_identical_directories() {
    let left = temp_dir("identical-l");
    let right = temp_dir("identical-r");
    std::fs::write(left.join("a.txt"), "hello").unwrap();
    std::fs::write(right.join("a.txt"), "hello").unwrap();

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "size".to_string(),
        recursive: false,
    })
    .unwrap();

    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].name, "a.txt");
    assert_eq!(result.entries[0].status, "same");
}

#[test]
fn sync_file_only_in_left() {
    let left = temp_dir("onlyleft-l");
    let right = temp_dir("onlyleft-r");
    std::fs::write(left.join("b.txt"), "data").unwrap();

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "name".to_string(),
        recursive: false,
    })
    .unwrap();

    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].status, "onlyLeft");
    assert_eq!(result.entries[0].left_size, Some(4));
    assert!(result.entries[0].right_size.is_none());
}

#[test]
fn sync_file_only_in_right() {
    let left = temp_dir("onlyright-l");
    let right = temp_dir("onlyright-r");
    std::fs::write(right.join("c.txt"), "data").unwrap();

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "name".to_string(),
        recursive: false,
    })
    .unwrap();

    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].status, "onlyRight");
    assert!(result.entries[0].left_size.is_none());
    assert_eq!(result.entries[0].right_size, Some(4));
}

#[test]
fn sync_different_sizes() {
    let left = temp_dir("diffsize-l");
    let right = temp_dir("diffsize-r");
    std::fs::write(left.join("a.txt"), "short").unwrap();
    std::fs::write(right.join("a.txt"), "much longer content").unwrap();

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "size".to_string(),
        recursive: false,
    })
    .unwrap();

    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].status, "different");
}

#[test]
fn sync_by_name_always_same() {
    let left = temp_dir("byname-l");
    let right = temp_dir("byname-r");
    std::fs::write(left.join("a.txt"), "content1").unwrap();
    std::fs::write(right.join("a.txt"), "completely different").unwrap();

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "name".to_string(),
        recursive: false,
    })
    .unwrap();

    assert_eq!(result.entries[0].status, "same");
}

#[test]
fn sync_missing_directory_error() {
    let left = temp_dir("missing-l");

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: "local:///nonexistent/xyz".to_string(),
        comparison: "name".to_string(),
        recursive: false,
    });
    assert!(result.is_err());
}

#[test]
fn sync_empty_directories() {
    let left = temp_dir("empty-l");
    let right = temp_dir("empty-r");

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "name".to_string(),
        recursive: false,
    })
    .unwrap();

    assert!(result.entries.is_empty());
    assert_eq!(result.left_uri, local_uri(&left));
    assert_eq!(result.right_uri, local_uri(&right));
}

#[test]
fn sync_multiple_files_mixed() {
    let left = temp_dir("mixed-l");
    let right = temp_dir("mixed-r");
    std::fs::write(left.join("both.txt"), "same").unwrap();
    std::fs::write(right.join("both.txt"), "same").unwrap();
    std::fs::write(left.join("left_only.txt"), "data").unwrap();
    std::fs::write(right.join("right_only.txt"), "data").unwrap();

    let result = sync_directories_logic(&SyncDirectoriesRequest {
        left_uri: local_uri(&left),
        right_uri: local_uri(&right),
        comparison: "size".to_string(),
        recursive: false,
    })
    .unwrap();

    assert_eq!(result.entries.len(), 3);
    assert!(result
        .entries
        .iter()
        .any(|e| e.name == "both.txt" && e.status == "same"));
    assert!(result
        .entries
        .iter()
        .any(|e| e.name == "left_only.txt" && e.status == "onlyLeft"));
    assert!(result
        .entries
        .iter()
        .any(|e| e.name == "right_only.txt" && e.status == "onlyRight"));
}
