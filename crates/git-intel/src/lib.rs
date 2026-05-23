use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

fn git_optional_output(path: &Path, args: &[&str]) -> Result<Option<String>, GitError> {
    match git_output(path, args)? {
        GitCommandOutput::Success(value) => {
            let value = value.trim();
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value.to_string()))
            }
        }
        GitCommandOutput::NotRepository => Ok(None),
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
    let mut entries = HashMap::new();
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
        if matches!(record.as_bytes().first(), Some(b'R') | Some(b'C')) && index < records.len() {
            index += 1;
        }

        let uri = ResourceUri::from_local_path(&root.join(path))
            .map_err(|error| GitError::InvalidUri(error.to_string()))?;
        entries.insert(uri, status);
    }

    Ok(entries)
}

fn status_from_xy(xy: &str) -> GitFileStatus {
    let bytes = xy.as_bytes();
    let x = bytes.first().copied().unwrap_or(b' ');
    let y = bytes.get(1).copied().unwrap_or(b' ');

    match (x, y) {
        (b'?', b'?') => GitFileStatus::Untracked,
        (b'!', b'!') => GitFileStatus::Ignored,
        (b'U', _) | (_, b'U') => GitFileStatus::Conflicted,
        (b'R', _) | (_, b'R') => GitFileStatus::Renamed,
        (b'D', _) | (_, b'D') => GitFileStatus::Deleted,
        (b'A', _) | (_, b'A') => GitFileStatus::Added,
        (b'M', _) | (_, b'M') => GitFileStatus::Modified,
        (b' ', b' ') => GitFileStatus::Clean,
        _ => GitFileStatus::Unknown,
    }
}
