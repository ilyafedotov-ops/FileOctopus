use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use similar::TextDiff;
use thiserror::Error;
use vfs::ResourceUri;

#[derive(Clone, Default)]
pub struct GitService;

impl GitService {
    pub fn new() -> Self {
        Self
    }

    pub async fn discover(&self, uri: &ResourceUri) -> Result<Option<GitRepoInfo>, GitError> {
        let path = local_working_path(uri)?;

        tokio::task::spawn_blocking(move || discover_blocking(&path))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn status_for_directory(
        &self,
        uri: &ResourceUri,
    ) -> Result<GitDirectoryStatus, GitError> {
        let path = local_working_path(uri)?;

        tokio::task::spawn_blocking(move || status_for_directory_blocking(&path))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn status_for_repository(
        &self,
        uri: &ResourceUri,
    ) -> Result<GitRepositoryStatus, GitError> {
        let path = local_git_context_path(uri)?;

        tokio::task::spawn_blocking(move || status_for_repository_blocking(&path))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn diff_file(
        &self,
        uri: &ResourceUri,
        max_bytes: Option<u64>,
    ) -> Result<GitFileDiff, GitError> {
        if uri.scheme() != "local" {
            return Err(GitError::UnsupportedProvider);
        }
        let file_path = uri
            .to_local_path()
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        let context_path = local_git_context_path(uri)?;

        tokio::task::spawn_blocking(move || {
            diff_file_blocking(&context_path, &file_path, max_bytes.unwrap_or(512 * 1024))
        })
        .await
        .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn history(
        &self,
        uri: &ResourceUri,
        max_count: Option<u32>,
    ) -> Result<GitHistory, GitError> {
        let path = local_git_context_path(uri)?;

        tokio::task::spawn_blocking(move || history_blocking(&path, max_count))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn branches(&self, uri: &ResourceUri) -> Result<GitBranches, GitError> {
        let path = local_git_context_path(uri)?;

        tokio::task::spawn_blocking(move || branches_blocking(&path))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn worktrees(&self, uri: &ResourceUri) -> Result<GitWorktrees, GitError> {
        let path = local_git_context_path(uri)?;

        tokio::task::spawn_blocking(move || worktrees_blocking(&path))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn revision_diff(
        &self,
        uri: &ResourceUri,
        base: &str,
        head: &str,
        max_bytes: Option<u64>,
    ) -> Result<GitRevisionDiff, GitError> {
        let path = local_git_context_path(uri)?;
        let base = base.to_string();
        let head = head.to_string();

        tokio::task::spawn_blocking(move || {
            revision_diff_blocking(&path, &base, &head, max_bytes.unwrap_or(512 * 1024))
        })
        .await
        .map_err(|error| GitError::Internal(error.to_string()))?
    }

    pub async fn revision_files(
        &self,
        uri: &ResourceUri,
        revision: Option<&str>,
        max_count: Option<u32>,
    ) -> Result<GitRevisionFiles, GitError> {
        let path = local_git_context_path(uri)?;
        let revision = revision.unwrap_or("HEAD").to_string();

        tokio::task::spawn_blocking(move || revision_files_blocking(&path, &revision, max_count))
            .await
            .map_err(|error| GitError::Internal(error.to_string()))?
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfo {
    pub root_uri: ResourceUri,
    pub branch: Option<String>,
    pub head_short: Option<String>,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDirectoryStatus {
    pub repo: Option<GitRepoInfo>,
    pub entries: HashMap<ResourceUri, GitFileStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepositoryStatus {
    pub repo: Option<GitRepoInfo>,
    pub files: Vec<GitChangedFile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChangedFile {
    pub uri: ResourceUri,
    pub repo_relative_path: String,
    pub status: GitFileStatus,
    pub previous_uri: Option<ResourceUri>,
    pub previous_repo_relative_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileDiff {
    pub repo: Option<GitRepoInfo>,
    pub file: GitChangedFile,
    pub old_label: String,
    pub new_label: String,
    pub hunks: Vec<GitDiffHunk>,
    pub old_line_count: u64,
    pub new_line_count: u64,
    pub old_truncated: bool,
    pub new_truncated: bool,
    pub binary: bool,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHistory {
    pub repo: Option<GitRepoInfo>,
    pub commits: Vec<GitCommit>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub authored_at: String,
    pub subject: String,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranches {
    pub repo: Option<GitRepoInfo>,
    pub branches: Vec<GitBranch>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub full_name: String,
    pub name: String,
    pub kind: String,
    pub is_current: bool,
    pub head: String,
    pub upstream: Option<String>,
    pub last_commit_at: Option<String>,
    pub subject: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktrees {
    pub repo: Option<GitRepoInfo>,
    pub worktrees: Vec<GitWorktree>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktree {
    pub path_uri: ResourceUri,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub prunable: bool,
    pub prunable_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionDiff {
    pub repo: Option<GitRepoInfo>,
    pub base: String,
    pub head: String,
    pub files: Vec<GitFileDiff>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFiles {
    pub repo: Option<GitRepoInfo>,
    pub revision: String,
    pub files: Vec<GitRevisionFile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFile {
    pub uri: ResourceUri,
    pub repo_relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffLine {
    pub kind: String,
    pub content: String,
    pub old_line: Option<u64>,
    pub new_line: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffHunk {
    pub old_start: u64,
    pub old_count: u64,
    pub new_start: u64,
    pub new_count: u64,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "git/GitFileStatus.ts"))]
#[serde(rename_all = "camelCase")]
pub enum GitFileStatus {
    Clean,
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Ignored,
    Conflicted,
    Unknown,
}

#[derive(Debug, Error)]
pub enum GitError {
    #[error("git intelligence only supports local resources")]
    UnsupportedProvider,
    #[error("invalid local URI: {0}")]
    InvalidUri(String),
    #[error("git command failed: {0}")]
    CommandFailed(String),
    #[error("internal git service error: {0}")]
    Internal(String),
}

impl GitError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::UnsupportedProvider => "unsupported_provider",
            Self::InvalidUri(_) => "invalid_uri",
            Self::CommandFailed(_) => "git_command_failed",
            Self::Internal(_) => "internal",
        }
    }
}

fn local_working_path(uri: &ResourceUri) -> Result<PathBuf, GitError> {
    if uri.scheme() != "local" {
        return Err(GitError::UnsupportedProvider);
    }

    let path = uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    if path.is_file() {
        Ok(path
            .parent()
            .unwrap_or_else(|| Path::new("/"))
            .to_path_buf())
    } else {
        Ok(path)
    }
}

fn local_git_context_path(uri: &ResourceUri) -> Result<PathBuf, GitError> {
    if uri.scheme() != "local" {
        return Err(GitError::UnsupportedProvider);
    }

    let path = uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    if path.is_dir() {
        return Ok(path);
    }
    Ok(path
        .parent()
        .unwrap_or_else(|| Path::new("/"))
        .to_path_buf())
}

fn discover_blocking(path: &Path) -> Result<Option<GitRepoInfo>, GitError> {
    let root = match git_output(path, &["rev-parse", "--show-toplevel"])? {
        GitCommandOutput::Success(value) => PathBuf::from(value.trim()),
        GitCommandOutput::NotRepository => return Ok(None),
    };
    let root_uri = ResourceUri::from_local_path(&root)
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let branch = git_optional_output(&root, &["branch", "--show-current"])?;
    let head_short = git_optional_output(&root, &["rev-parse", "--short", "HEAD"])?;
    let is_dirty = match git_output(
        &root,
        &["status", "--porcelain", "--untracked-files=normal"],
    )? {
        GitCommandOutput::Success(value) => !value.trim().is_empty(),
        GitCommandOutput::NotRepository => false,
    };

    Ok(Some(GitRepoInfo {
        root_uri,
        branch,
        head_short,
        is_dirty,
    }))
}

fn status_for_repository_blocking(path: &Path) -> Result<GitRepositoryStatus, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitRepositoryStatus {
            repo: None,
            files: Vec::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let output = match git_output(
        &root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=normal"],
    )? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };

    let mut files = parse_porcelain_changed_files(&root, output.as_bytes())?
        .into_iter()
        .filter(|file| file.status != GitFileStatus::Ignored)
        .collect::<Vec<_>>();
    files.sort_by(|left, right| left.repo_relative_path.cmp(&right.repo_relative_path));

    Ok(GitRepositoryStatus {
        repo: Some(repo),
        files,
    })
}

fn status_for_directory_blocking(path: &Path) -> Result<GitDirectoryStatus, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitDirectoryStatus {
            repo: None,
            entries: HashMap::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let output = match git_output(
        &root,
        &[
            "status",
            "--porcelain=v1",
            "-z",
            "--ignored=matching",
            "--untracked-files=normal",
        ],
    )? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };

    let mut entries = parse_porcelain_status(&root, output.as_bytes())?;
    entries.retain(|uri, _| {
        uri.to_local_path()
            .map(|entry_path| entry_path.starts_with(path))
            .unwrap_or(false)
    });

    Ok(GitDirectoryStatus {
        repo: Some(repo),
        entries,
    })
}

fn history_blocking(path: &Path, max_count: Option<u32>) -> Result<GitHistory, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitHistory {
            repo: None,
            commits: Vec::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;

    if !git_has_head(&root)? {
        return Ok(GitHistory {
            repo: Some(repo),
            commits: Vec::new(),
        });
    }

    let limit = max_count.unwrap_or(100).clamp(1, 100).to_string();
    let output = match git_output(
        &root,
        &[
            "log",
            &format!("--max-count={limit}"),
            "--date=iso-strict",
            "--pretty=format:%H%x00%h%x00%P%x00%an%x00%ae%x00%aI%x00%s%x00%B%x1e",
        ],
    )? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };

    Ok(GitHistory {
        repo: Some(repo),
        commits: parse_history(&output),
    })
}

fn branches_blocking(path: &Path) -> Result<GitBranches, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitBranches {
            repo: None,
            branches: Vec::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let output = match git_output(
        &root,
        &[
            "for-each-ref",
            "--format=%(refname)%00%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(HEAD)%00%(committerdate:iso-strict)%00%(subject)%1e",
            "refs/heads",
            "refs/remotes",
        ],
    )? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };

    Ok(GitBranches {
        repo: Some(repo),
        branches: parse_branches(&output),
    })
}

fn worktrees_blocking(path: &Path) -> Result<GitWorktrees, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitWorktrees {
            repo: None,
            worktrees: Vec::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let output = match git_output(&root, &["worktree", "list", "--porcelain", "-z"])? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };

    Ok(GitWorktrees {
        repo: Some(repo),
        worktrees: parse_worktrees(&output)?,
    })
}

fn revision_diff_blocking(
    path: &Path,
    base: &str,
    head: &str,
    max_bytes: u64,
) -> Result<GitRevisionDiff, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitRevisionDiff {
            repo: None,
            base: base.to_string(),
            head: head.to_string(),
            files: Vec::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let output = match git_output(&root, &["diff", "--name-status", "-M", "-z", base, head])? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };
    let changed_files = parse_name_status_changed_files(&root, output.as_bytes())?;
    let mut files = Vec::new();

    for file in changed_files {
        let old_path = file
            .previous_repo_relative_path
            .as_deref()
            .unwrap_or(&file.repo_relative_path)
            .to_string();
        let old_bytes = match file.status {
            GitFileStatus::Added | GitFileStatus::Untracked => Vec::new(),
            _ => git_blob_bytes_at(&root, base, &old_path).unwrap_or_default(),
        };
        let new_bytes = match file.status {
            GitFileStatus::Deleted => Vec::new(),
            _ => git_blob_bytes_at(&root, head, &file.repo_relative_path).unwrap_or_default(),
        };
        let old_label = format!("{base}:{old_path}");
        let new_label = format!("{head}:{}", file.repo_relative_path);
        files.push(build_file_diff_with_labels(
            repo.clone(),
            file,
            old_bytes,
            new_bytes,
            max_bytes,
            old_label,
            new_label,
        )?);
    }

    Ok(GitRevisionDiff {
        repo: Some(repo),
        base: base.to_string(),
        head: head.to_string(),
        files,
    })
}

fn revision_files_blocking(
    path: &Path,
    revision: &str,
    max_count: Option<u32>,
) -> Result<GitRevisionFiles, GitError> {
    let Some(repo) = discover_blocking(path)? else {
        return Ok(GitRevisionFiles {
            repo: None,
            revision: revision.to_string(),
            files: Vec::new(),
        });
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let output = match git_output(&root, &["ls-tree", "-r", "-z", "--name-only", revision])? {
        GitCommandOutput::Success(value) => value,
        GitCommandOutput::NotRepository => String::new(),
    };
    let limit = max_count.unwrap_or(1000).clamp(1, 5000) as usize;
    let files = output
        .split('\0')
        .filter(|path| !path.is_empty())
        .take(limit)
        .map(|path| {
            ResourceUri::from_local_path(&root.join(path))
                .map(|uri| GitRevisionFile {
                    uri,
                    repo_relative_path: path.to_string(),
                })
                .map_err(|error| GitError::InvalidUri(error.to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(GitRevisionFiles {
        repo: Some(repo),
        revision: revision.to_string(),
        files,
    })
}

fn diff_file_blocking(
    context_path: &Path,
    file_path: &Path,
    max_bytes: u64,
) -> Result<GitFileDiff, GitError> {
    let Some(repo) = discover_blocking(context_path)? else {
        return Err(GitError::CommandFailed("not a git repository".to_string()));
    };
    let root = repo
        .root_uri
        .to_local_path()
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    let repo_relative_path = relative_git_path(&root, file_path)?;
    let repository_status = status_for_repository_blocking(&root)?;
    let file = repository_status
        .files
        .into_iter()
        .find(|file| file.repo_relative_path == repo_relative_path)
        .unwrap_or_else(|| GitChangedFile {
            uri: ResourceUri::from_local_path(file_path).unwrap_or_else(|_| repo.root_uri.clone()),
            repo_relative_path: repo_relative_path.clone(),
            status: GitFileStatus::Clean,
            previous_uri: None,
            previous_repo_relative_path: None,
        });
    let old_path = file
        .previous_repo_relative_path
        .as_deref()
        .unwrap_or(&file.repo_relative_path)
        .to_string();
    let has_head = git_has_head(&root)?;

    let old_bytes = match file.status {
        GitFileStatus::Added | GitFileStatus::Untracked if !has_head => Vec::new(),
        GitFileStatus::Added | GitFileStatus::Untracked => Vec::new(),
        _ if has_head => git_blob_bytes_at(&root, "HEAD", &old_path).unwrap_or_default(),
        _ => Vec::new(),
    };
    let new_bytes = match file.status {
        GitFileStatus::Deleted => Vec::new(),
        _ => fs::read(root.join(&file.repo_relative_path)).unwrap_or_default(),
    };

    build_file_diff(repo, file, &old_path, old_bytes, new_bytes, max_bytes)
}

fn build_file_diff(
    repo: GitRepoInfo,
    file: GitChangedFile,
    old_path: &str,
    old_bytes: Vec<u8>,
    new_bytes: Vec<u8>,
    max_bytes: u64,
) -> Result<GitFileDiff, GitError> {
    let old_label = format!("HEAD:{}", old_path);
    let new_label = format!("Worktree:{}", file.repo_relative_path);

    build_file_diff_with_labels(
        repo, file, old_bytes, new_bytes, max_bytes, old_label, new_label,
    )
}

fn build_file_diff_with_labels(
    repo: GitRepoInfo,
    file: GitChangedFile,
    old_bytes: Vec<u8>,
    new_bytes: Vec<u8>,
    max_bytes: u64,
    old_label: String,
    new_label: String,
) -> Result<GitFileDiff, GitError> {
    let old_truncated = old_bytes.len() as u64 > max_bytes;
    let new_truncated = new_bytes.len() as u64 > max_bytes;

    if old_truncated || new_truncated {
        return Ok(GitFileDiff {
            repo: Some(repo),
            file,
            old_label,
            new_label,
            hunks: Vec::new(),
            old_line_count: 0,
            new_line_count: 0,
            old_truncated,
            new_truncated,
            binary: false,
            unsupported_reason: Some("file_too_large".to_string()),
        });
    }

    if old_bytes.contains(&0) || new_bytes.contains(&0) {
        return Ok(GitFileDiff {
            repo: Some(repo),
            file,
            old_label,
            new_label,
            hunks: Vec::new(),
            old_line_count: 0,
            new_line_count: 0,
            old_truncated: false,
            new_truncated: false,
            binary: true,
            unsupported_reason: Some("binary".to_string()),
        });
    }

    let old_text = match std::str::from_utf8(&old_bytes) {
        Ok(value) => value,
        Err(_) => {
            return Ok(GitFileDiff {
                repo: Some(repo),
                file,
                old_label,
                new_label,
                hunks: Vec::new(),
                old_line_count: 0,
                new_line_count: 0,
                old_truncated: false,
                new_truncated: false,
                binary: true,
                unsupported_reason: Some("binary".to_string()),
            });
        }
    };
    let new_text = match std::str::from_utf8(&new_bytes) {
        Ok(value) => value,
        Err(_) => {
            return Ok(GitFileDiff {
                repo: Some(repo),
                file,
                old_label,
                new_label,
                hunks: Vec::new(),
                old_line_count: 0,
                new_line_count: 0,
                old_truncated: false,
                new_truncated: false,
                binary: true,
                unsupported_reason: Some("binary".to_string()),
            });
        }
    };

    Ok(GitFileDiff {
        repo: Some(repo),
        file,
        old_label,
        new_label,
        hunks: compute_diff_hunks(old_text, new_text),
        old_line_count: old_text.lines().count() as u64,
        new_line_count: new_text.lines().count() as u64,
        old_truncated: false,
        new_truncated: false,
        binary: false,
        unsupported_reason: None,
    })
}

fn relative_git_path(root: &Path, file_path: &Path) -> Result<String, GitError> {
    let relative = file_path
        .strip_prefix(root)
        .map_err(|error| GitError::InvalidUri(error.to_string()))?;
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn git_has_head(path: &Path) -> Result<bool, GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--verify", "HEAD"])
        .output()
        .map_err(|error| GitError::CommandFailed(error.to_string()))?;
    if output.status.success() {
        return Ok(true);
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("not a git repository") {
        return Err(GitError::CommandFailed(stderr.trim().to_string()));
    }
    Ok(false)
}

fn git_blob_bytes_at(
    path: &Path,
    revision: &str,
    relative_path: &str,
) -> Result<Vec<u8>, GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .arg("show")
        .arg(format!("{revision}:{relative_path}"))
        .output()
        .map_err(|error| GitError::CommandFailed(error.to_string()))?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    Err(GitError::CommandFailed(
        String::from_utf8_lossy(&output.stderr).trim().to_string(),
    ))
}

fn git_optional_output(path: &Path, args: &[&str]) -> Result<Option<String>, GitError> {
    match git_output(path, args) {
        Ok(GitCommandOutput::Success(value)) => {
            let value = value.trim();
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value.to_string()))
            }
        }
        Ok(GitCommandOutput::NotRepository) => Ok(None),
        Err(GitError::CommandFailed(message))
            if message.contains("Needed a single revision")
                || message.contains("ambiguous argument 'HEAD'") =>
        {
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

enum GitCommandOutput {
    Success(String),
    NotRepository,
}

fn git_output(path: &Path, args: &[&str]) -> Result<GitCommandOutput, GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|error| GitError::CommandFailed(error.to_string()))?;

    if output.status.success() {
        return Ok(GitCommandOutput::Success(
            String::from_utf8_lossy(&output.stdout).to_string(),
        ));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("not a git repository") {
        return Ok(GitCommandOutput::NotRepository);
    }

    Err(GitError::CommandFailed(stderr.trim().to_string()))
}

fn parse_porcelain_status(
    root: &Path,
    output: &[u8],
) -> Result<HashMap<ResourceUri, GitFileStatus>, GitError> {
    Ok(parse_porcelain_changed_files(root, output)?
        .into_iter()
        .map(|file| (file.uri, file.status))
        .collect())
}

fn parse_porcelain_changed_files(
    root: &Path,
    output: &[u8],
) -> Result<Vec<GitChangedFile>, GitError> {
    let mut files = Vec::new();
    let records = output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .collect::<Vec<_>>();
    let mut index = 0;

    while index < records.len() {
        let record = String::from_utf8_lossy(records[index]);
        index += 1;

        if record.len() < 4 {
            continue;
        }

        let status = status_from_xy(&record[0..2]);
        let path = record[3..].to_string();
        let previous_repo_relative_path = if matches!(
            record.as_bytes().first(),
            Some(b'R') | Some(b'C')
        ) && index < records.len()
        {
            let previous = String::from_utf8_lossy(records[index]).to_string();
            index += 1;
            Some(previous)
        } else {
            None
        };

        let uri = ResourceUri::from_local_path(&root.join(&path))
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        let previous_uri = previous_repo_relative_path
            .as_ref()
            .map(|path| ResourceUri::from_local_path(&root.join(path)))
            .transpose()
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        files.push(GitChangedFile {
            uri,
            repo_relative_path: path,
            status,
            previous_uri,
            previous_repo_relative_path,
        });
    }

    Ok(files)
}

fn parse_name_status_changed_files(
    root: &Path,
    output: &[u8],
) -> Result<Vec<GitChangedFile>, GitError> {
    let tokens = output
        .split(|byte| *byte == 0)
        .filter(|token| !token.is_empty())
        .map(|token| String::from_utf8_lossy(token).to_string())
        .collect::<Vec<_>>();
    let mut files = Vec::new();
    let mut index = 0;

    while index < tokens.len() {
        let status_token = &tokens[index];
        index += 1;
        if index >= tokens.len() {
            break;
        }
        let status = status_from_name_status(status_token);
        let previous_repo_relative_path =
            if status_token.starts_with('R') || status_token.starts_with('C') {
                let previous = tokens[index].clone();
                index += 1;
                if index >= tokens.len() {
                    break;
                }
                Some(previous)
            } else {
                None
            };
        let path = tokens[index].clone();
        index += 1;
        let uri = ResourceUri::from_local_path(&root.join(&path))
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        let previous_uri = previous_repo_relative_path
            .as_ref()
            .map(|path| ResourceUri::from_local_path(&root.join(path)))
            .transpose()
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        files.push(GitChangedFile {
            uri,
            repo_relative_path: path,
            status,
            previous_uri,
            previous_repo_relative_path,
        });
    }

    files.sort_by(|left, right| left.repo_relative_path.cmp(&right.repo_relative_path));
    Ok(files)
}

fn parse_history(output: &str) -> Vec<GitCommit> {
    output
        .split('\x1e')
        .filter_map(|record| {
            let record = record.trim_start_matches('\n');
            if record.trim().is_empty() {
                return None;
            }
            let fields = record.splitn(8, '\0').collect::<Vec<_>>();
            if fields.len() < 8 {
                return None;
            }
            Some(GitCommit {
                hash: fields[0].to_string(),
                short_hash: fields[1].to_string(),
                parents: fields[2]
                    .split_whitespace()
                    .map(ToString::to_string)
                    .collect(),
                author_name: fields[3].to_string(),
                author_email: fields[4].to_string(),
                authored_at: fields[5].to_string(),
                subject: fields[6].to_string(),
                body: fields[7].trim_end_matches('\n').to_string(),
            })
        })
        .collect()
}

fn parse_branches(output: &str) -> Vec<GitBranch> {
    let mut branches = output
        .split('\x1e')
        .filter_map(|record| {
            let record = record.trim_start_matches('\n');
            if record.trim().is_empty() {
                return None;
            }
            let fields = record.splitn(7, '\0').collect::<Vec<_>>();
            if fields.len() < 7 || fields[0].ends_with("/HEAD") {
                return None;
            }
            let kind = if fields[0].starts_with("refs/heads/") {
                "local"
            } else {
                "remote"
            };
            Some(GitBranch {
                full_name: fields[0].to_string(),
                name: fields[1].to_string(),
                kind: kind.to_string(),
                is_current: fields[4] == "*",
                head: fields[2].to_string(),
                upstream: non_empty(fields[3]),
                last_commit_at: non_empty(fields[5]),
                subject: fields[6].to_string(),
            })
        })
        .collect::<Vec<_>>();

    branches.sort_by(|left, right| {
        left.kind
            .cmp(&right.kind)
            .then_with(|| left.name.cmp(&right.name))
    });
    branches
}

fn parse_worktrees(output: &str) -> Result<Vec<GitWorktree>, GitError> {
    #[derive(Default)]
    struct PendingWorktree {
        path: Option<PathBuf>,
        branch: Option<String>,
        head: Option<String>,
        detached: bool,
        bare: bool,
        prunable: bool,
        prunable_reason: Option<String>,
    }

    fn flush(
        pending: &mut PendingWorktree,
        worktrees: &mut Vec<GitWorktree>,
    ) -> Result<(), GitError> {
        let Some(path) = pending.path.take() else {
            return Ok(());
        };
        let path_uri = ResourceUri::from_local_path(&path)
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        worktrees.push(GitWorktree {
            path_uri,
            branch: pending.branch.take(),
            head: pending.head.take(),
            detached: pending.detached,
            bare: pending.bare,
            prunable: pending.prunable,
            prunable_reason: pending.prunable_reason.take(),
        });
        pending.detached = false;
        pending.bare = false;
        pending.prunable = false;
        Ok(())
    }

    let mut worktrees = Vec::new();
    let mut pending = PendingWorktree::default();
    for token in output.split('\0') {
        if token.is_empty() {
            flush(&mut pending, &mut worktrees)?;
            continue;
        }
        if let Some(path) = token.strip_prefix("worktree ") {
            flush(&mut pending, &mut worktrees)?;
            pending.path = Some(PathBuf::from(path));
        } else if let Some(head) = token.strip_prefix("HEAD ") {
            pending.head = Some(head.to_string());
        } else if let Some(branch) = token.strip_prefix("branch ") {
            pending.branch = Some(
                branch
                    .strip_prefix("refs/heads/")
                    .unwrap_or(branch)
                    .to_string(),
            );
        } else if token == "detached" {
            pending.detached = true;
        } else if token == "bare" {
            pending.bare = true;
        } else if token == "prunable" {
            pending.prunable = true;
        } else if let Some(reason) = token.strip_prefix("prunable ") {
            pending.prunable = true;
            pending.prunable_reason = Some(reason.to_string());
        }
    }
    flush(&mut pending, &mut worktrees)?;

    Ok(worktrees)
}

fn non_empty(value: &str) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn compute_diff_hunks(old_text: &str, new_text: &str) -> Vec<GitDiffHunk> {
    let diff = TextDiff::from_lines(old_text, new_text);
    let mut hunks: Vec<GitDiffHunk> = Vec::new();
    let mut current_lines: Vec<GitDiffLine> = Vec::new();
    let mut current_old_start: u64 = 0;
    let mut current_new_start: u64 = 0;
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

        let line = GitDiffLine {
            kind: kind.to_string(),
            content: change.to_string_lossy().to_string(),
            old_line,
            new_line,
        };

        if kind == "equal" && in_hunk {
            let equal_count = current_lines
                .iter()
                .rev()
                .take_while(|line| line.kind == "equal")
                .count();
            if equal_count >= 3 {
                current_lines.push(line);
                hunks.push(build_hunk(
                    current_old_start,
                    current_new_start,
                    current_lines.clone(),
                ));
                current_lines.clear();
                in_hunk = false;
                continue;
            }
        }

        if !in_hunk && kind != "equal" {
            if !current_lines.is_empty() {
                let equal_count = current_lines
                    .iter()
                    .rev()
                    .take_while(|line| line.kind == "equal")
                    .count();
                let context_count = equal_count.min(3);
                current_lines.truncate(current_lines.len() - equal_count);
                let context: Vec<GitDiffLine> = current_lines
                    .drain(current_lines.len().saturating_sub(context_count)..)
                    .collect();
                current_lines.extend(context);
            }
            current_old_start = old_line.unwrap_or(1);
            current_new_start = new_line.unwrap_or(1);
            in_hunk = true;
        }

        current_lines.push(line);
    }

    if !current_lines.is_empty() && in_hunk {
        hunks.push(build_hunk(
            current_old_start,
            current_new_start,
            current_lines,
        ));
    }

    hunks
}

fn build_hunk(old_start: u64, new_start: u64, lines: Vec<GitDiffLine>) -> GitDiffHunk {
    let old_count = lines
        .iter()
        .filter(|line| line.kind == "equal" || line.kind == "delete")
        .count() as u64;
    let new_count = lines
        .iter()
        .filter(|line| line.kind == "equal" || line.kind == "insert")
        .count() as u64;
    GitDiffHunk {
        old_start,
        old_count,
        new_start,
        new_count,
        lines,
    }
}

fn status_from_xy(xy: &str) -> GitFileStatus {
    let bytes = xy.as_bytes();
    let x = bytes.first().copied().unwrap_or(b' ');
    let y = bytes.get(1).copied().unwrap_or(b' ');

    match (x, y) {
        (b'?', b'?') => GitFileStatus::Untracked,
        (b'!', b'!') => GitFileStatus::Ignored,
        (b'U', _) | (_, b'U') => GitFileStatus::Conflicted,
        (b'R', _) | (_, b'R') | (b'C', _) | (_, b'C') => GitFileStatus::Renamed,
        (b'D', _) | (_, b'D') => GitFileStatus::Deleted,
        (b'A', _) | (_, b'A') => GitFileStatus::Added,
        (b'M', _) | (_, b'M') => GitFileStatus::Modified,
        (b' ', b' ') => GitFileStatus::Clean,
        _ => GitFileStatus::Unknown,
    }
}

fn status_from_name_status(status: &str) -> GitFileStatus {
    match status.as_bytes().first().copied() {
        Some(b'M') => GitFileStatus::Modified,
        Some(b'A') => GitFileStatus::Added,
        Some(b'D') => GitFileStatus::Deleted,
        Some(b'R') | Some(b'C') => GitFileStatus::Renamed,
        _ => GitFileStatus::Unknown,
    }
}
