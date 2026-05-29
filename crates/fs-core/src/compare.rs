use std::fs;
use std::path::Path;

use vfs::{FileOperationError, ResourceUri};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompareMode {
    Text,
    Binary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffLineType {
    Context,
    Added,
    Removed,
    Changed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffLine {
    pub line_number_left: Option<usize>,
    pub line_number_right: Option<usize>,
    pub content: String,
    pub line_type: DiffLineType,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ByteDifference {
    pub offset: usize,
    pub left_byte: u8,
    pub right_byte: u8,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompareResult {
    pub identical: bool,
    pub hunks: Vec<DiffHunk>,
    pub byte_differences: Vec<ByteDifference>,
}

pub fn compare_files(
    left_uri: &ResourceUri,
    right_uri: &ResourceUri,
    mode: CompareMode,
) -> Result<CompareResult, FileOperationError> {
    let left_path = left_uri.to_local_path()?;
    let right_path = right_uri.to_local_path()?;

    if !left_path.is_file() {
        return Err(FileOperationError::DestinationMissing {
            uri: left_uri.as_str().to_string(),
        });
    }
    if !right_path.is_file() {
        return Err(FileOperationError::DestinationMissing {
            uri: right_uri.as_str().to_string(),
        });
    }

    match mode {
        CompareMode::Text => compare_text_files(&left_path, &right_path),
        CompareMode::Binary => compare_binary_files(&left_path, &right_path),
    }
}

fn compare_text_files(
    left_path: &Path,
    right_path: &Path,
) -> Result<CompareResult, FileOperationError> {
    let left_content = fs::read_to_string(left_path).map_err(|e| FileOperationError::Io {
        message: format!("Failed to read {}: {}", left_path.display(), e),
    })?;
    let right_content = fs::read_to_string(right_path).map_err(|e| FileOperationError::Io {
        message: format!("Failed to read {}: {}", right_path.display(), e),
    })?;

    let left_lines: Vec<&str> = left_content.lines().collect();
    let right_lines: Vec<&str> = right_content.lines().collect();

    let identical = left_content == right_content;

    let hunks = compute_diff_hunks(&left_lines, &right_lines);

    Ok(CompareResult {
        identical,
        hunks,
        byte_differences: Vec::new(),
    })
}

fn compare_binary_files(
    left_path: &Path,
    right_path: &Path,
) -> Result<CompareResult, FileOperationError> {
    let left_bytes = fs::read(left_path).map_err(|e| FileOperationError::Io {
        message: format!("Failed to read {}: {}", left_path.display(), e),
    })?;
    let right_bytes = fs::read(right_path).map_err(|e| FileOperationError::Io {
        message: format!("Failed to read {}: {}", right_path.display(), e),
    })?;

    let identical = left_bytes == right_bytes;

    let max_len = left_bytes.len().max(right_bytes.len());
    let mut differences = Vec::new();

    for i in 0..max_len {
        let lb = left_bytes.get(i).copied().unwrap_or(0);
        let rb = right_bytes.get(i).copied().unwrap_or(0);
        if lb != rb {
            differences.push(ByteDifference {
                offset: i,
                left_byte: lb,
                right_byte: rb,
            });
        }
    }

    Ok(CompareResult {
        identical,
        hunks: Vec::new(),
        byte_differences: differences,
    })
}

/// Simple line-level diff using longest common subsequence (LCS).
/// Produces DiffLine entries with proper line numbering.
fn compute_diff_hunks(left: &[&str], right: &[&str]) -> Vec<DiffHunk> {
    if left.is_empty() && right.is_empty() {
        return Vec::new();
    }

    let mut lcs_table = vec![vec![0usize; right.len() + 1]; left.len() + 1];

    // Build LCS table
    for li in 1..=left.len() {
        for ri in 1..=right.len() {
            if left[li - 1] == right[ri - 1] {
                lcs_table[li][ri] = lcs_table[li - 1][ri - 1] + 1;
            } else {
                lcs_table[li][ri] = lcs_table[li - 1][ri].max(lcs_table[li][ri - 1]);
            }
        }
    }

    // Backtrack to produce diff operations
    let mut ops: Vec<DiffOp> = Vec::new();
    let mut i = left.len();
    let mut j = right.len();

    while i > 0 || j > 0 {
        if i > 0 && j > 0 && left[i - 1] == right[j - 1] {
            ops.push(DiffOp::Equal);
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || lcs_table[i][j - 1] >= lcs_table[i - 1][j]) {
            ops.push(DiffOp::Add);
            j -= 1;
        } else {
            ops.push(DiffOp::Remove);
            i -= 1;
        }
    }

    ops.reverse();

    // Convert ops to hunks
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current_lines: Vec<DiffLine> = Vec::new();
    let mut li = 0usize; // current left line number (0-based)
    let mut ri = 0usize; // current right line number (0-based)
    let mut hunk_old_start = 0usize;
    let mut hunk_new_start = 0usize;
    let mut hunk_old_count = 0usize;
    let mut hunk_new_count = 0usize;
    let mut in_hunk = false;

    let mut context_count = 0usize;
    let context_size = 3;

    for op in &ops {
        match op {
            DiffOp::Equal => {
                if in_hunk {
                    current_lines.push(DiffLine {
                        line_number_left: Some(li + 1),
                        line_number_right: Some(ri + 1),
                        content: left[li].to_string(),
                        line_type: DiffLineType::Context,
                    });
                    context_count += 1;
                    hunk_old_count += 1;
                    hunk_new_count += 1;
                    if context_count >= context_size {
                        hunks.push(DiffHunk {
                            old_start: hunk_old_start + 1,
                            old_count: hunk_old_count,
                            new_start: hunk_new_start + 1,
                            new_count: hunk_new_count,
                            lines: current_lines.clone(),
                        });
                        current_lines.clear();
                        in_hunk = false;
                    }
                }
                li += 1;
                ri += 1;
            }
            DiffOp::Add => {
                if !in_hunk {
                    in_hunk = true;
                    hunk_old_start = li;
                    hunk_new_start = ri;
                }
                current_lines.push(DiffLine {
                    line_number_left: None,
                    line_number_right: Some(ri + 1),
                    content: right[ri].to_string(),
                    line_type: DiffLineType::Added,
                });
                hunk_new_count += 1;
                context_count = 0;
                ri += 1;
            }
            DiffOp::Remove => {
                if !in_hunk {
                    in_hunk = true;
                    hunk_old_start = li;
                    hunk_new_start = ri;
                }
                current_lines.push(DiffLine {
                    line_number_left: Some(li + 1),
                    line_number_right: None,
                    content: left[li].to_string(),
                    line_type: DiffLineType::Removed,
                });
                hunk_old_count += 1;
                context_count = 0;
                li += 1;
            }
        }
    }

    // Flush remaining hunk
    if !current_lines.is_empty() {
        hunks.push(DiffHunk {
            old_start: hunk_old_start + 1,
            old_count: hunk_old_count,
            new_start: hunk_new_start + 1,
            new_count: hunk_new_count,
            lines: current_lines,
        });
    }

    hunks
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DiffOp {
    Equal,
    Add,
    Remove,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn uri_for(path: &std::path::Path) -> ResourceUri {
        ResourceUri::from_local_path(path).unwrap()
    }

    #[test]
    fn identical_files_return_identical() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "hello\nworld\n").unwrap();
        fs::write(dir.path().join("b.txt"), "hello\nworld\n").unwrap();
        let left = uri_for(&dir.path().join("a.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text).unwrap();
        assert!(result.identical);
        assert!(
            result.hunks.is_empty()
                || result
                    .hunks
                    .iter()
                    .all(|h| h.lines.iter().all(|l| l.line_type == DiffLineType::Context))
        );
    }

    #[test]
    fn added_lines_detected() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "line1\nline3\n").unwrap();
        fs::write(dir.path().join("b.txt"), "line1\nline2\nline3\n").unwrap();
        let left = uri_for(&dir.path().join("a.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text).unwrap();
        assert!(!result.identical);
        assert!(result
            .hunks
            .iter()
            .flat_map(|h| h.lines.iter())
            .any(|l| l.line_type == DiffLineType::Added));
    }

    #[test]
    fn removed_lines_detected() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "line1\nline2\nline3\n").unwrap();
        fs::write(dir.path().join("b.txt"), "line1\nline3\n").unwrap();
        let left = uri_for(&dir.path().join("a.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text).unwrap();
        assert!(!result.identical);
        assert!(result
            .hunks
            .iter()
            .flat_map(|h| h.lines.iter())
            .any(|l| l.line_type == DiffLineType::Removed));
    }

    #[test]
    fn binary_identical_files() {
        let dir = TempDir::new().unwrap();
        let data = vec![0x00u8, 0x01, 0x02, 0x03];
        fs::write(dir.path().join("a.bin"), &data).unwrap();
        fs::write(dir.path().join("b.bin"), &data).unwrap();
        let left = uri_for(&dir.path().join("a.bin"));
        let right = uri_for(&dir.path().join("b.bin"));
        let result = compare_files(&left, &right, CompareMode::Binary).unwrap();
        assert!(result.identical);
        assert!(result.byte_differences.is_empty());
    }

    #[test]
    fn binary_differences_detected() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.bin"), vec![0x00u8, 0x01, 0x02]).unwrap();
        fs::write(dir.path().join("b.bin"), vec![0x00u8, 0xFF, 0x02]).unwrap();
        let left = uri_for(&dir.path().join("a.bin"));
        let right = uri_for(&dir.path().join("b.bin"));
        let result = compare_files(&left, &right, CompareMode::Binary).unwrap();
        assert!(!result.identical);
        assert_eq!(result.byte_differences.len(), 1);
        assert_eq!(result.byte_differences[0].offset, 1);
        assert_eq!(result.byte_differences[0].left_byte, 0x01);
        assert_eq!(result.byte_differences[0].right_byte, 0xFF);
    }

    #[test]
    fn binary_different_lengths() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.bin"), vec![0x00u8, 0x01]).unwrap();
        fs::write(dir.path().join("b.bin"), vec![0x00u8, 0x01, 0x02]).unwrap();
        let left = uri_for(&dir.path().join("a.bin"));
        let right = uri_for(&dir.path().join("b.bin"));
        let result = compare_files(&left, &right, CompareMode::Binary).unwrap();
        assert!(!result.identical);
        assert_eq!(result.byte_differences.len(), 1);
        assert_eq!(result.byte_differences[0].offset, 2);
        assert_eq!(result.byte_differences[0].left_byte, 0);
        assert_eq!(result.byte_differences[0].right_byte, 0x02);
    }

    #[test]
    fn missing_left_file_returns_error() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("b.txt"), "hello\n").unwrap();
        let left = uri_for(&dir.path().join("nonexistent.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text);
        assert!(result.is_err());
    }

    #[test]
    fn directory_input_returns_error() {
        let dir = TempDir::new().unwrap();
        let subdir_path = dir.path().join("subdir");
        fs::create_dir(&subdir_path).unwrap();
        let left = uri_for(&subdir_path);
        let right = uri_for(&dir.path().join("b.txt"));
        fs::write(dir.path().join("b.txt"), "hello\n").unwrap();
        let result = compare_files(&left, &right, CompareMode::Text);
        assert!(result.is_err());
    }

    #[test]
    fn empty_files_are_identical() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "").unwrap();
        fs::write(dir.path().join("b.txt"), "").unwrap();
        let left = uri_for(&dir.path().join("a.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text).unwrap();
        assert!(result.identical);
    }

    #[test]
    fn diff_lines_have_correct_numbers() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "a\nb\nc\n").unwrap();
        fs::write(dir.path().join("b.txt"), "a\nx\nc\n").unwrap();
        let left = uri_for(&dir.path().join("a.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text).unwrap();
        let removed: Vec<_> = result
            .hunks
            .iter()
            .flat_map(|h| h.lines.iter())
            .filter(|l| l.line_type == DiffLineType::Removed)
            .collect();
        let added: Vec<_> = result
            .hunks
            .iter()
            .flat_map(|h| h.lines.iter())
            .filter(|l| l.line_type == DiffLineType::Added)
            .collect();
        assert!(!removed.is_empty());
        assert_eq!(removed[0].line_number_left, Some(2));
        assert!(removed[0].line_number_right.is_none());
        assert!(!added.is_empty());
        assert!(added[0].line_number_left.is_none());
        assert_eq!(added[0].line_number_right, Some(2));
    }

    #[test]
    fn completely_different_files() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "aaa\nbbb\n").unwrap();
        fs::write(dir.path().join("b.txt"), "xxx\nyyy\n").unwrap();
        let left = uri_for(&dir.path().join("a.txt"));
        let right = uri_for(&dir.path().join("b.txt"));
        let result = compare_files(&left, &right, CompareMode::Text).unwrap();
        assert!(!result.identical);
        let all_removed: Vec<_> = result
            .hunks
            .iter()
            .flat_map(|h| h.lines.iter())
            .filter(|l| l.line_type == DiffLineType::Removed)
            .collect();
        let all_added: Vec<_> = result
            .hunks
            .iter()
            .flat_map(|h| h.lines.iter())
            .filter(|l| l.line_type == DiffLineType::Added)
            .collect();
        assert!(all_removed.len() >= 2);
        assert!(all_added.len() >= 2);
    }
}
