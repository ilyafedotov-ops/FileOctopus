//! Integration tests for fs_diff_text command logic.

use std::path::{Path, PathBuf};

use app_ipc::{DiffHunk, DiffLine, DiffTextRequest, IpcError};
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-diff-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn local_uri(path: &Path) -> String {
    ResourceUri::from_local_path(path)
        .unwrap()
        .as_str()
        .to_string()
}

/// Simulates the fs_diff_text handler logic:
/// parse both URIs → read files → compute diff → return hunks
fn diff_text_logic(request: &DiffTextRequest) -> Result<app_ipc::DiffTextResponse, IpcError> {
    let left_uri = ResourceUri::parse(&request.left_uri).map_err(IpcError::from)?;
    let left_path = left_uri.to_local_path().map_err(IpcError::from)?;

    let right_uri = ResourceUri::parse(&request.right_uri).map_err(IpcError::from)?;
    let right_path = right_uri.to_local_path().map_err(IpcError::from)?;

    let left_meta = std::fs::metadata(&left_path).map_err(|e| IpcError::io(e.to_string()))?;
    if left_meta.is_dir() {
        return Err(IpcError::is_directory("cannot diff a directory"));
    }

    let right_meta = std::fs::metadata(&right_path).map_err(|e| IpcError::io(e.to_string()))?;
    if right_meta.is_dir() {
        return Err(IpcError::is_directory("cannot diff a directory"));
    }

    let max_bytes = request.max_bytes.unwrap_or(512 * 1024);

    let left_bytes = std::fs::read(&left_path).map_err(|e| IpcError::io(e.to_string()))?;
    let right_bytes = std::fs::read(&right_path).map_err(|e| IpcError::io(e.to_string()))?;

    let left_truncated = left_bytes.len() as u64 > max_bytes;
    let right_truncated = right_bytes.len() as u64 > max_bytes;

    let left_str =
        String::from_utf8_lossy(&left_bytes[..(left_bytes.len().min(max_bytes as usize))]);
    let right_str =
        String::from_utf8_lossy(&right_bytes[..(right_bytes.len().min(max_bytes as usize))]);

    let left_lines: Vec<&str> = left_str.lines().collect();
    let right_lines: Vec<&str> = right_str.lines().collect();

    let diff = similar::TextDiff::from_lines(&left_str, &right_str);

    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current_lines: Vec<DiffLine> = Vec::new();
    let mut current_old_start: u64 = 0;
    let mut current_new_start: u64 = 0;
    let mut current_old_count: u64 = 0;
    let mut current_new_count: u64 = 0;
    let mut in_hunk = false;

    for change in diff.iter_all_changes() {
        let (kind, old_line, new_line) = match change.tag() {
            similar::ChangeTag::Equal => (
                "equal",
                Some(change.old_index().unwrap() as u64 + 1),
                Some(change.new_index().unwrap() as u64 + 1),
            ),
            similar::ChangeTag::Delete => {
                ("delete", Some(change.old_index().unwrap() as u64 + 1), None)
            }
            similar::ChangeTag::Insert => {
                ("insert", None, Some(change.new_index().unwrap() as u64 + 1))
            }
        };

        let line = DiffLine {
            kind: kind.to_string(),
            content: change.to_string_lossy().to_string(),
            old_line,
            new_line,
        };

        if kind == "equal" && in_hunk {
            let equal_count = current_lines
                .iter()
                .rev()
                .take_while(|l| l.kind == "equal")
                .count();
            if equal_count >= 3 {
                current_lines.push(line);
                current_old_count = current_lines
                    .iter()
                    .filter(|l| l.kind == "equal" || l.kind == "delete")
                    .count() as u64;
                current_new_count = current_lines
                    .iter()
                    .filter(|l| l.kind == "equal" || l.kind == "insert")
                    .count() as u64;
                hunks.push(DiffHunk {
                    old_start: current_old_start,
                    old_count: current_old_count,
                    new_start: current_new_start,
                    new_count: current_new_count,
                    lines: current_lines.clone(),
                });
                current_lines.clear();
                in_hunk = false;
                continue;
            }
        }

        if !in_hunk && kind != "equal" {
            if !current_lines.is_empty() {
                let eq_count = current_lines
                    .iter()
                    .rev()
                    .take_while(|l| l.kind == "equal")
                    .count();
                let context_count = eq_count.min(3);
                current_lines.truncate(current_lines.len() - eq_count);
                let context: Vec<DiffLine> = current_lines
                    .drain(current_lines.len().saturating_sub(context_count)..)
                    .collect();
                current_lines.extend(context);
            }
            current_old_start = old_line.unwrap_or(current_old_count + 1);
            current_new_start = new_line.unwrap_or(current_new_count + 1);
            current_old_count = 0;
            current_new_count = 0;
            in_hunk = true;
        }

        current_lines.push(line);
    }

    if !current_lines.is_empty() && in_hunk {
        current_old_count = current_lines
            .iter()
            .filter(|l| l.kind == "equal" || l.kind == "delete")
            .count() as u64;
        current_new_count = current_lines
            .iter()
            .filter(|l| l.kind == "equal" || l.kind == "insert")
            .count() as u64;
        hunks.push(DiffHunk {
            old_start: current_old_start,
            old_count: current_old_count,
            new_start: current_new_start,
            new_count: current_new_count,
            lines: current_lines,
        });
    }

    Ok(app_ipc::DiffTextResponse {
        hunks,
        left_line_count: left_lines.len() as u64,
        right_line_count: right_lines.len() as u64,
        left_truncated,
        right_truncated,
    })
}

#[test]
fn diff_identical_files() {
    let dir = temp_dir("identical");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    std::fs::write(&left, "hello\nworld\n").unwrap();
    std::fs::write(&right, "hello\nworld\n").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    })
    .unwrap();

    assert_eq!(result.left_line_count, 2);
    assert_eq!(result.right_line_count, 2);
    assert!(!result.left_truncated);
    assert!(!result.right_truncated);
    // Identical files produce no hunks (all equal, split by context boundaries)
    assert_eq!(result.hunks.len(), 0);
}

#[test]
fn diff_added_line() {
    let dir = temp_dir("added");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    std::fs::write(&left, "aaa\nbbb\nccc\n").unwrap();
    std::fs::write(&right, "aaa\nbbb\nNEW\nccc\n").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    })
    .unwrap();

    assert_eq!(result.left_line_count, 3);
    assert_eq!(result.right_line_count, 4);
    assert_eq!(result.hunks.len(), 1);

    let hunk = &result.hunks[0];
    let inserts: Vec<&DiffLine> = hunk.lines.iter().filter(|l| l.kind == "insert").collect();
    assert_eq!(inserts.len(), 1);
    assert_eq!(inserts[0].content.trim(), "NEW");
}

#[test]
fn diff_removed_line() {
    let dir = temp_dir("removed");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    std::fs::write(&left, "aaa\nbbb\nccc\nddd\n").unwrap();
    std::fs::write(&right, "aaa\nddd\n").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    })
    .unwrap();

    assert_eq!(result.left_line_count, 4);
    assert_eq!(result.right_line_count, 2);
    assert_eq!(result.hunks.len(), 1);

    let hunk = &result.hunks[0];
    let deletes: Vec<&DiffLine> = hunk.lines.iter().filter(|l| l.kind == "delete").collect();
    assert!(deletes.len() >= 2); // at least bbb and ccc deleted
}

#[test]
fn diff_changed_line() {
    let dir = temp_dir("changed");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    std::fs::write(&left, "aaa\nbbb\nccc\n").unwrap();
    std::fs::write(&right, "aaa\nBBB\nccc\n").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    })
    .unwrap();

    assert_eq!(result.hunks.len(), 1);
    let hunk = &result.hunks[0];
    let deletes: Vec<&DiffLine> = hunk.lines.iter().filter(|l| l.kind == "delete").collect();
    let inserts: Vec<&DiffLine> = hunk.lines.iter().filter(|l| l.kind == "insert").collect();
    assert_eq!(deletes.len(), 1);
    assert_eq!(inserts.len(), 1);
    assert_eq!(deletes[0].content.trim(), "bbb");
    assert_eq!(inserts[0].content.trim(), "BBB");
}

#[test]
fn diff_directory_error() {
    let dir = temp_dir("direrr");
    let subdir = dir.join("subdir");
    std::fs::create_dir_all(&subdir).unwrap();
    let right = dir.join("right.txt");
    std::fs::write(&right, "hello\n").unwrap();

    let left_uri = local_uri(&subdir);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    });
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "is_directory");
}

#[test]
fn diff_missing_file_error() {
    let dir = temp_dir("missing");
    let right = dir.join("right.txt");
    std::fs::write(&right, "hello\n").unwrap();

    let left_uri = local_uri(&dir.join("nonexistent.txt"));
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    });
    assert!(result.is_err());
}

#[test]
fn diff_truncation() {
    let dir = temp_dir("trunc");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    // Create a file larger than max_bytes
    let large_content: String = (0..10000).map(|i| format!("line {}\n", i)).collect();
    std::fs::write(&left, &large_content).unwrap();
    std::fs::write(&right, "short\n").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: Some(100),
    })
    .unwrap();

    assert!(result.left_truncated);
    assert!(!result.right_truncated);
}

#[test]
fn diff_empty_files() {
    let dir = temp_dir("empty");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    std::fs::write(&left, "").unwrap();
    std::fs::write(&right, "").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    })
    .unwrap();

    assert_eq!(result.left_line_count, 0);
    assert_eq!(result.right_line_count, 0);
    assert_eq!(result.hunks.len(), 0);
}

#[test]
fn diff_empty_vs_content() {
    let dir = temp_dir("empty_vs_content");
    let left = dir.join("left.txt");
    let right = dir.join("right.txt");
    std::fs::write(&left, "").unwrap();
    std::fs::write(&right, "aaa\nbbb\n").unwrap();

    let left_uri = local_uri(&left);
    let right_uri = local_uri(&right);

    let result = diff_text_logic(&DiffTextRequest {
        left_uri,
        right_uri,
        max_bytes: None,
    })
    .unwrap();

    assert_eq!(result.left_line_count, 0);
    assert_eq!(result.right_line_count, 2);
    assert_eq!(result.hunks.len(), 1);
    let hunk = &result.hunks[0];
    let inserts: Vec<&DiffLine> = hunk.lines.iter().filter(|l| l.kind == "insert").collect();
    assert_eq!(inserts.len(), 2);
}
