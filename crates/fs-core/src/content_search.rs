use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

use chrono::{DateTime, Utc};
use jobs::CancellationToken;
use vfs::{FileKind, FileOperationError, ResourceUri};

use crate::metadata::file_kind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContentSearchResult {
    pub matches: Vec<ContentSearchMatch>,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContentSearchMatch {
    pub uri: String,
    pub parent_uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Clone)]
pub struct ContentSearchOptions {
    pub case_sensitive: bool,
    pub use_regex: bool,
    pub file_pattern: Option<String>,
    pub max_file_size: u64,
}

impl Default for ContentSearchOptions {
    fn default() -> Self {
        Self {
            case_sensitive: false,
            use_regex: false,
            file_pattern: None,
            max_file_size: 10 * 1024 * 1024,
        }
    }
}

pub fn content_search(
    uri: &ResourceUri,
    query: &str,
    limit: usize,
    options: ContentSearchOptions,
) -> Result<ContentSearchResult, FileOperationError> {
    content_search_with_progress(
        uri,
        query,
        limit,
        options,
        &CancellationToken::new(),
        |_, _| {},
    )
}

pub fn content_search_with_progress(
    uri: &ResourceUri,
    query: &str,
    limit: usize,
    options: ContentSearchOptions,
    cancel: &CancellationToken,
    mut on_match: impl FnMut(&ContentSearchMatch, &ContentSearchResult),
) -> Result<ContentSearchResult, FileOperationError> {
    let path = uri.to_local_path()?;
    let query_text = if options.case_sensitive {
        query.to_string()
    } else {
        query.to_lowercase()
    };

    let mut result = ContentSearchResult {
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

    let regex = if options.use_regex {
        match regex::RegexBuilder::new(query)
            .case_insensitive(!options.case_sensitive)
            .build()
        {
            Ok(r) => Some(r),
            Err(e) => {
                result.warnings.push(format!("Invalid regex: {}", e));
                return Ok(result);
            }
        }
    } else {
        None
    };

    search_folder_content(
        &path,
        &query_text,
        regex.as_ref(),
        &options,
        limit.max(1),
        &mut result,
        cancel,
        &mut on_match,
    )?;

    Ok(result)
}

fn matches_file_pattern(name: &str, pattern: &Option<String>) -> bool {
    match pattern {
        None => true,
        Some(p) => {
            let patterns: Vec<&str> = p.split(',').map(|s| s.trim()).collect();
            patterns.iter().any(|pat| {
                if let Some(stripped) = pat.strip_prefix('*') {
                    name.ends_with(stripped)
                } else if let Some(stripped) = pat.strip_suffix('*') {
                    name.starts_with(stripped)
                } else {
                    name == *pat
                }
            })
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn search_folder_content(
    path: &Path,
    query: &str,
    regex: Option<&regex::Regex>,
    options: &ContentSearchOptions,
    limit: usize,
    result: &mut ContentSearchResult,
    cancel: &CancellationToken,
    on_match: &mut impl FnMut(&ContentSearchMatch, &ContentSearchResult),
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

        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            search_folder_content(
                &entry_path,
                query,
                regex,
                options,
                limit,
                result,
                cancel,
                on_match,
            )?;
        } else if metadata.is_file() {
            if metadata.len() > options.max_file_size {
                continue;
            }

            if !matches_file_pattern(&name, &options.file_pattern) {
                continue;
            }

            search_file_content(
                &entry_path,
                query,
                regex,
                options,
                limit,
                result,
                cancel,
                on_match,
            );
        }
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn search_file_content(
    path: &Path,
    query: &str,
    regex: Option<&regex::Regex>,
    options: &ContentSearchOptions,
    limit: usize,
    result: &mut ContentSearchResult,
    cancel: &CancellationToken,
    on_match: &mut impl FnMut(&ContentSearchMatch, &ContentSearchResult),
) {
    if cancel.is_cancelled() {
        return;
    }

    if result.matches.len() >= limit {
        return;
    }

    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(e) => {
            result.incomplete = true;
            result.warnings.push(format!("{}: {}", path.display(), e));
            return;
        }
    };

    let reader = BufReader::new(file);
    let metadata = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return,
    };
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let uri = match ResourceUri::from_local_path(path) {
        Ok(u) => u,
        Err(_) => return,
    };
    let parent_uri = path
        .parent()
        .and_then(|p| ResourceUri::from_local_path(p).ok())
        .map(|u| u.as_str().to_string())
        .unwrap_or_default();

    for (line_idx, line_result) in reader.lines().enumerate() {
        if cancel.is_cancelled() {
            return;
        }

        if result.matches.len() >= limit {
            return;
        }

        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

        let search_line = if options.case_sensitive {
            line.clone()
        } else {
            line.to_lowercase()
        };

        let (match_start, match_end) = if let Some(re) = regex {
            match re.find(&line) {
                Some(m) => (m.start(), m.end()),
                None => continue,
            }
        } else if let Some(pos) = search_line.find(query) {
            (pos, pos + query.len())
        } else {
            continue;
        };

        let m = ContentSearchMatch {
            uri: uri.as_str().to_string(),
            parent_uri: parent_uri.clone(),
            name: name.clone(),
            kind: file_kind(&metadata),
            size: Some(metadata.len()),
            modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
            line_number: line_idx + 1,
            line_content: line,
            match_start,
            match_end,
        };

        result.matches.push(m.clone());
        if let Some(last) = result.matches.last() {
            on_match(last, result);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn make_dir_with_files() -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("hello.txt"), "hello world\nfoo bar\n").unwrap();
        fs::write(dir.path().join("data.csv"), "name,age\nAlice,30\nBob,25\n").unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();
        fs::write(
            dir.path().join("subdir/nested.txt"),
            "nested hello\nworld\n",
        )
        .unwrap();
        dir
    }

    fn uri_for(path: &std::path::Path) -> ResourceUri {
        ResourceUri::from_local_path(path).unwrap()
    }

    #[test]
    fn search_finds_matches_in_files() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let result = content_search(&uri, "hello", 100, ContentSearchOptions::default()).unwrap();
        assert_eq!(result.matches.len(), 2); // hello.txt + subdir/nested.txt
        assert!(result
            .matches
            .iter()
            .any(|m| m.name == "hello.txt" && m.line_number == 1));
        assert!(result
            .matches
            .iter()
            .any(|m| m.name == "nested.txt" && m.line_number == 1));
    }

    #[test]
    fn search_is_case_insensitive_by_default() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let result = content_search(&uri, "HELLO", 100, ContentSearchOptions::default()).unwrap();
        assert!(!result.matches.is_empty());
    }

    #[test]
    fn search_case_sensitive_mode() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let opts = ContentSearchOptions {
            case_sensitive: true,
            ..ContentSearchOptions::default()
        };
        let result = content_search(&uri, "HELLO", 100, opts).unwrap();
        assert!(result.matches.is_empty());
    }

    #[test]
    fn search_regex_mode() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let opts = ContentSearchOptions {
            use_regex: true,
            ..ContentSearchOptions::default()
        };
        let result = content_search(&uri, r"\d{2}", 100, opts).unwrap();
        assert!(result
            .matches
            .iter()
            .any(|m| m.name == "data.csv" && m.line_content.contains("Alice,30")));
    }

    #[test]
    fn search_file_pattern_filter() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let opts = ContentSearchOptions {
            file_pattern: Some("*.txt".to_string()),
            ..ContentSearchOptions::default()
        };
        let result = content_search(&uri, "hello", 100, opts).unwrap();
        assert!(result.matches.iter().all(|m| m.name.ends_with(".txt")));
    }

    #[test]
    fn search_respects_limit() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let result = content_search(&uri, "hello", 1, ContentSearchOptions::default()).unwrap();
        assert_eq!(result.matches.len(), 1);
        // Note: incomplete flag is set for IO errors, not limit capping
    }

    #[test]
    fn search_empty_query_returns_empty() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let result = content_search(&uri, "", 100, ContentSearchOptions::default()).unwrap();
        assert!(result.matches.is_empty());
    }

    #[test]
    fn search_nonexistent_path_returns_error() {
        let uri = ResourceUri::parse("local:///nonexistent/path/xyz").unwrap();
        let result = content_search(&uri, "test", 100, ContentSearchOptions::default());
        assert!(result.is_err());
    }

    #[test]
    fn search_file_path_returns_error() {
        let dir = make_dir_with_files();
        let uri = uri_for(&dir.path().join("hello.txt"));
        let result = content_search(&uri, "hello", 100, ContentSearchOptions::default());
        assert!(result.is_err());
    }

    #[test]
    fn search_match_positions_are_correct() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("test.txt"), "abcdefg\n").unwrap();
        let uri = uri_for(dir.path());
        let result = content_search(&uri, "cde", 100, ContentSearchOptions::default()).unwrap();
        assert_eq!(result.matches.len(), 1);
        let m = &result.matches[0];
        assert_eq!(m.match_start, 2);
        assert_eq!(m.match_end, 5);
        assert_eq!(m.line_content, "abcdefg");
    }

    #[test]
    fn search_max_file_size_skips_large_files() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("big.txt"), "hello world\n").unwrap();
        let uri = uri_for(dir.path());
        let opts = ContentSearchOptions {
            max_file_size: 5, // smaller than file
            ..ContentSearchOptions::default()
        };
        let result = content_search(&uri, "hello", 100, opts).unwrap();
        assert!(result.matches.is_empty());
    }

    #[test]
    fn matches_file_pattern_wildcard_extension() {
        assert!(matches_file_pattern("test.txt", &Some("*.txt".to_string())));
        assert!(!matches_file_pattern(
            "test.csv",
            &Some("*.txt".to_string())
        ));
    }

    #[test]
    fn matches_file_pattern_none_accepts_all() {
        assert!(matches_file_pattern("anything.xyz", &None));
    }

    #[test]
    fn matches_file_pattern_comma_separated() {
        assert!(matches_file_pattern(
            "test.txt",
            &Some("*.txt,*.csv".to_string())
        ));
        assert!(matches_file_pattern(
            "test.csv",
            &Some("*.txt,*.csv".to_string())
        ));
        assert!(!matches_file_pattern(
            "test.rs",
            &Some("*.txt,*.csv".to_string())
        ));
    }

    #[test]
    fn search_invalid_regex_returns_warning() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let opts = ContentSearchOptions {
            use_regex: true,
            ..ContentSearchOptions::default()
        };
        let result = content_search(&uri, "[invalid", 100, opts).unwrap();
        assert!(result.matches.is_empty());
        assert!(!result.warnings.is_empty());
    }

    #[test]
    fn search_progress_callback_receives_matches() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("test.txt"), "aaa\nbbb\nccc\n").unwrap();
        let uri = uri_for(dir.path());
        let cancel = CancellationToken::new();
        let mut received: Vec<String> = Vec::new();
        let result = content_search_with_progress(
            &uri,
            "aaa",
            100,
            ContentSearchOptions::default(),
            &cancel,
            |m, _| received.push(m.name.clone()),
        )
        .unwrap();
        assert_eq!(result.matches.len(), 1);
        assert_eq!(received.len(), 1);
        assert_eq!(received[0], "test.txt");
    }

    #[test]
    fn search_cancellation_returns_error() {
        let dir = make_dir_with_files();
        let uri = uri_for(dir.path());
        let cancel = CancellationToken::new();
        cancel.cancel();
        let result = content_search_with_progress(
            &uri,
            "hello",
            100,
            ContentSearchOptions::default(),
            &cancel,
            |_, _| {},
        );
        assert!(result.is_err());
    }
}
