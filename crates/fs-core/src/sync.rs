use std::collections::HashMap;
use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use vfs::{FileOperationError, ResourceUri};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncComparison {
    ByName,
    BySize,
    ByDate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncFileStatus {
    OnlyLeft,
    OnlyRight,
    Same,
    NewerLeft,
    NewerRight,
    Different,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncEntry {
    pub name: String,
    pub left_uri: Option<String>,
    pub right_uri: Option<String>,
    pub left_size: Option<u64>,
    pub right_size: Option<u64>,
    pub left_modified: Option<DateTime<Utc>>,
    pub right_modified: Option<DateTime<Utc>>,
    pub left_is_dir: bool,
    pub right_is_dir: bool,
    pub status: SyncFileStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncPlan {
    pub left_uri: String,
    pub right_uri: String,
    pub entries: Vec<SyncEntry>,
    pub recursive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncAction {
    CopyLeftToRight,
    CopyRightToLeft,
    DeleteLeft,
    DeleteRight,
    Skip,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncActionItem {
    pub entry_name: String,
    pub action: SyncAction,
}

pub fn compare_directories(
    left_uri: &ResourceUri,
    right_uri: &ResourceUri,
    comparison: SyncComparison,
    recursive: bool,
) -> Result<SyncPlan, FileOperationError> {
    let left_path = left_uri.to_local_path()?;
    let right_path = right_uri.to_local_path()?;

    if !left_path.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: left_uri.as_str().to_string(),
        });
    }
    if !right_path.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: right_uri.as_str().to_string(),
        });
    }

    let mut entries = Vec::new();
    collect_sync_entries(
        &left_path,
        &right_path,
        left_uri,
        right_uri,
        comparison,
        recursive,
        &mut entries,
    )?;

    Ok(SyncPlan {
        left_uri: left_uri.as_str().to_string(),
        right_uri: right_uri.as_str().to_string(),
        entries,
        recursive,
    })
}

fn collect_sync_entries(
    left_path: &Path,
    right_path: &Path,
    _left_uri: &ResourceUri,
    _right_uri: &ResourceUri,
    comparison: SyncComparison,
    _recursive: bool,
    entries: &mut Vec<SyncEntry>,
) -> Result<(), FileOperationError> {
    let mut left_map: HashMap<String, (u64, Option<DateTime<Utc>>, bool)> = HashMap::new();
    let mut right_map: HashMap<String, (u64, Option<DateTime<Utc>>, bool)> = HashMap::new();

    // Read left directory
    if let Ok(read_dir) = fs::read_dir(left_path) {
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Ok(metadata) = entry.metadata() {
                let is_dir = metadata.is_dir();
                let size = if is_dir { 0 } else { metadata.len() };
                let modified = metadata.modified().ok().map(DateTime::<Utc>::from);
                left_map.insert(name, (size, modified, is_dir));
            }
        }
    }

    // Read right directory
    if let Ok(read_dir) = fs::read_dir(right_path) {
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Ok(metadata) = entry.metadata() {
                let is_dir = metadata.is_dir();
                let size = if is_dir { 0 } else { metadata.len() };
                let modified = metadata.modified().ok().map(DateTime::<Utc>::from);
                right_map.insert(name, (size, modified, is_dir));
            }
        }
    }

    let all_names: std::collections::BTreeSet<String> =
        left_map.keys().chain(right_map.keys()).cloned().collect();

    for name in all_names {
        let left = left_map.get(&name);
        let right = right_map.get(&name);

        let left_uri_str = left.map(|_| {
            ResourceUri::from_local_path(&left_path.join(&name))
                .map(|u| u.as_str().to_string())
                .unwrap_or_default()
        });
        let right_uri_str = right.map(|_| {
            ResourceUri::from_local_path(&right_path.join(&name))
                .map(|u| u.as_str().to_string())
                .unwrap_or_default()
        });

        let status = match (left, right) {
            (Some(_), None) => SyncFileStatus::OnlyLeft,
            (None, Some(_)) => SyncFileStatus::OnlyRight,
            (None, None) => SyncFileStatus::Same, // unreachable in practice
            (Some((ls, lm, _ld)), Some((rs, rm, _rd))) => match comparison {
                SyncComparison::ByName => SyncFileStatus::Same,
                SyncComparison::BySize => {
                    if ls == rs {
                        SyncFileStatus::Same
                    } else {
                        SyncFileStatus::Different
                    }
                }
                SyncComparison::ByDate => match (lm, rm) {
                    (Some(lm), Some(rm)) => {
                        if lm == rm {
                            SyncFileStatus::Same
                        } else if lm > rm {
                            SyncFileStatus::NewerLeft
                        } else {
                            SyncFileStatus::NewerRight
                        }
                    }
                    _ => SyncFileStatus::Different,
                },
            },
        };

        let left_is_dir = left.map(|(_, _, d)| *d).unwrap_or(false);
        let right_is_dir = right.map(|(_, _, d)| *d).unwrap_or(false);

        entries.push(SyncEntry {
            name,
            left_uri: left_uri_str,
            right_uri: right_uri_str,
            left_size: left.map(|(s, _, _)| *s),
            right_size: right.map(|(s, _, _)| *s),
            left_modified: left.and_then(|(_, m, _)| *m),
            right_modified: right.and_then(|(_, m, _)| *m),
            left_is_dir,
            right_is_dir,
            status,
        });
    }

    Ok(())
}

pub fn generate_sync_actions(plan: &SyncPlan) -> Vec<SyncActionItem> {
    plan.entries
        .iter()
        .map(|entry| {
            let action = match &entry.status {
                SyncFileStatus::OnlyLeft => SyncAction::CopyLeftToRight,
                SyncFileStatus::OnlyRight => SyncAction::CopyRightToLeft,
                SyncFileStatus::Same => SyncAction::Skip,
                SyncFileStatus::NewerLeft => SyncAction::CopyLeftToRight,
                SyncFileStatus::NewerRight => SyncAction::CopyRightToLeft,
                SyncFileStatus::Different => SyncAction::Skip,
            };
            SyncActionItem {
                entry_name: entry.name.clone(),
                action,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn uri_for(path: &std::path::Path) -> ResourceUri {
        ResourceUri::from_local_path(path).unwrap()
    }

    #[test]
    fn identical_directories_show_same() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("a.txt"), "hello").unwrap();
        fs::write(right.path().join("a.txt"), "hello").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::BySize,
            false,
        )
        .unwrap();

        assert_eq!(plan.entries.len(), 1);
        assert_eq!(plan.entries[0].name, "a.txt");
        assert_eq!(plan.entries[0].status, SyncFileStatus::Same);
    }

    #[test]
    fn file_only_in_left() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("b.txt"), "data").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::ByName,
            false,
        )
        .unwrap();

        assert_eq!(plan.entries.len(), 1);
        assert_eq!(plan.entries[0].status, SyncFileStatus::OnlyLeft);
    }

    #[test]
    fn file_only_in_right() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(right.path().join("c.txt"), "data").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::ByName,
            false,
        )
        .unwrap();

        assert_eq!(plan.entries.len(), 1);
        assert_eq!(plan.entries[0].status, SyncFileStatus::OnlyRight);
    }

    #[test]
    fn different_sizes_detected() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("a.txt"), "short").unwrap();
        fs::write(right.path().join("a.txt"), "much longer content").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::BySize,
            false,
        )
        .unwrap();

        assert_eq!(plan.entries.len(), 1);
        assert_eq!(plan.entries[0].status, SyncFileStatus::Different);
    }

    #[test]
    fn by_name_always_same_when_both_exist() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("a.txt"), "content1").unwrap();
        fs::write(right.path().join("a.txt"), "completely different").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::ByName,
            false,
        )
        .unwrap();

        assert_eq!(plan.entries[0].status, SyncFileStatus::Same);
    }

    #[test]
    fn missing_directory_returns_error() {
        let left = TempDir::new().unwrap();
        let bad_uri = ResourceUri::parse("local:///nonexistent/xyz").unwrap();

        let result = compare_directories(
            &uri_for(left.path()),
            &bad_uri,
            SyncComparison::ByName,
            false,
        );
        assert!(result.is_err());
    }

    #[test]
    fn file_instead_of_dir_returns_error() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("file.txt");
        fs::write(&file_path, "data").unwrap();

        let result = compare_directories(
            &uri_for(dir.path()),
            &uri_for(&file_path),
            SyncComparison::ByName,
            false,
        );
        assert!(result.is_err());
    }

    #[test]
    fn empty_directories_produce_empty_plan() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::ByName,
            false,
        )
        .unwrap();

        assert!(plan.entries.is_empty());
    }

    #[test]
    fn sync_actions_copy_only_left_to_right() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("a.txt"), "hello").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::ByName,
            false,
        )
        .unwrap();

        let actions = generate_sync_actions(&plan);
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].action, SyncAction::CopyLeftToRight);
        assert_eq!(actions[0].entry_name, "a.txt");
    }

    #[test]
    fn sync_actions_skip_same_files() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("a.txt"), "hello").unwrap();
        fs::write(right.path().join("a.txt"), "hello").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::BySize,
            false,
        )
        .unwrap();

        let actions = generate_sync_actions(&plan);
        assert_eq!(actions[0].action, SyncAction::Skip);
    }

    #[test]
    fn multiple_files_mixed_status() {
        let left = TempDir::new().unwrap();
        let right = TempDir::new().unwrap();
        fs::write(left.path().join("both.txt"), "same").unwrap();
        fs::write(right.path().join("both.txt"), "same").unwrap();
        fs::write(left.path().join("left_only.txt"), "data").unwrap();
        fs::write(right.path().join("right_only.txt"), "data").unwrap();

        let plan = compare_directories(
            &uri_for(left.path()),
            &uri_for(right.path()),
            SyncComparison::BySize,
            false,
        )
        .unwrap();

        assert_eq!(plan.entries.len(), 3);
        assert!(plan
            .entries
            .iter()
            .any(|e| e.name == "both.txt" && e.status == SyncFileStatus::Same));
        assert!(plan
            .entries
            .iter()
            .any(|e| e.name == "left_only.txt" && e.status == SyncFileStatus::OnlyLeft));
        assert!(plan
            .entries
            .iter()
            .any(|e| e.name == "right_only.txt" && e.status == SyncFileStatus::OnlyRight));
    }
}
