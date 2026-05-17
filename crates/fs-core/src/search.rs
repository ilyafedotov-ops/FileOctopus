use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use jobs::CancellationToken;
use vfs::{FileKind, FileOperationError, ResourceUri};

use crate::metadata::file_kind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchMatch {
    pub uri: String,
    pub parent_uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
}

pub fn recursive_search(
    uri: &ResourceUri,
    query: &str,
    limit: usize,
) -> Result<SearchResult, FileOperationError> {
    recursive_search_with_progress(uri, query, limit, &CancellationToken::new(), |_, _| {})
}

pub fn recursive_search_with_progress(
    uri: &ResourceUri,
    query: &str,
    limit: usize,
    cancel: &CancellationToken,
    mut on_match: impl FnMut(&SearchMatch, &SearchResult),
) -> Result<SearchResult, FileOperationError> {
    let path = uri.to_local_path()?;
    let query = query.trim().to_lowercase();
    let mut result = SearchResult {
        matches: Vec::new(),
        warnings: Vec::new(),
        incomplete: false,
    };

    if query.is_empty() {
        return Ok(result);
    }

    if !path.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        });
    }

    search_folder(
        &path,
        &query,
        limit.max(1),
        &mut result,
        cancel,
        &mut on_match,
    )?;

    Ok(result)
}

fn search_folder(
    path: &Path,
    query: &str,
    limit: usize,
    result: &mut SearchResult,
    cancel: &CancellationToken,
    on_match: &mut impl FnMut(&SearchMatch, &SearchResult),
) -> Result<(), FileOperationError> {
    if cancel.is_cancelled() {
        return Err(FileOperationError::Cancelled { job_id: None });
    }

    if result.matches.len() >= limit {
        return Ok(());
    }

    let read_dir = match fs::read_dir(path) {
        Ok(value) => value,
        Err(error) => {
            result.incomplete = true;
            result.warnings.push(error.to_string());
            return Ok(());
        }
    };

    for entry in read_dir {
        if cancel.is_cancelled() {
            return Err(FileOperationError::Cancelled { job_id: None });
        }

        if result.matches.len() >= limit {
            return Ok(());
        }

        let entry = match entry {
            Ok(value) => value,
            Err(error) => {
                result.incomplete = true;
                result.warnings.push(error.to_string());
                continue;
            }
        };
        let entry_path = entry.path();
        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(value) => value,
            Err(error) => {
                result.incomplete = true;
                result.warnings.push(error.to_string());
                continue;
            }
        };
        let name = entry.file_name().to_string_lossy().to_string();

        if name.to_lowercase().contains(query) {
            if let (Ok(uri), Some(parent)) = (
                ResourceUri::from_local_path(&entry_path),
                entry_path
                    .parent()
                    .and_then(|value| ResourceUri::from_local_path(value).ok()),
            ) {
                result.matches.push(SearchMatch {
                    uri: uri.as_str().to_string(),
                    parent_uri: parent.as_str().to_string(),
                    name: name.clone(),
                    kind: file_kind(&metadata),
                    size: metadata.is_file().then_some(metadata.len()),
                    modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
                });
                if let Some(last) = result.matches.last().cloned() {
                    on_match(&last, result);
                }
            }
        }

        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            search_folder(&entry_path, query, limit, result, cancel, on_match)?;
        }
    }

    Ok(())
}
