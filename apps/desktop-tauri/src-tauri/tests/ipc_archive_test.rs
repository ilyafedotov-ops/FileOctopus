//! Integration tests for fs_create_archive and fs_extract_archive command logic.

use std::path::{Path, PathBuf};

use app_ipc::IpcError;
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-archive-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn local_uri(path: &Path) -> String {
    format!("local://{}", path.display())
}

// ── Compress logic ──────────────────────────────────────────────────

/// Simulates the fs_create_archive handler logic:
/// parse destination URI → create zip → add source files/dirs
fn create_archive_logic(source_uris: &[String], destination_uri: &str) -> Result<(), IpcError> {
    let dest_uri = ResourceUri::parse(destination_uri).map_err(IpcError::from)?;
    let dest_path = dest_uri.to_local_path().map_err(IpcError::from)?;

    if source_uris.is_empty() {
        return Err(IpcError {
            code: "invalid_argument".to_string(),
            message: "no source URIs provided".to_string(),
        });
    }

    // Validate all source URIs
    let mut sources = Vec::new();
    for uri_str in source_uris {
        let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
        let path = uri.to_local_path().map_err(IpcError::from)?;
        if !path.exists() {
            return Err(IpcError {
                code: "not_found".to_string(),
                message: format!("source not found: {}", path.display()),
            });
        }
        sources.push(path);
    }

    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| IpcError {
            code: "io_error".to_string(),
            message: format!("failed to create destination directory: {e}"),
        })?;
    }

    let file = std::fs::File::create(&dest_path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to create archive: {e}"),
    })?;

    let mut archive = zip::ZipWriter::new(file);
    let options =
        zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for source in &sources {
        if source.is_dir() {
            add_dir_to_archive(&mut archive, source, source, &options)?;
        } else {
            add_file_to_archive(&mut archive, source, source, &options)?;
        }
    }

    archive.finish().map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to finalize archive: {e}"),
    })?;

    Ok(())
}

fn add_dir_to_archive<W: std::io::Write + std::io::Seek>(
    archive: &mut zip::ZipWriter<W>,
    base: &Path,
    dir: &Path,
    options: &zip::write::FileOptions,
) -> Result<(), IpcError> {
    let entries = std::fs::read_dir(dir).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to read directory: {e}"),
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| IpcError {
            code: "io_error".to_string(),
            message: format!("failed to read directory entry: {e}"),
        })?;
        let path = entry.path();
        if path.is_dir() {
            add_dir_to_archive(archive, base, &path, options)?;
        } else {
            add_file_to_archive(archive, base, &path, options)?;
        }
    }

    Ok(())
}

fn add_file_to_archive<W: std::io::Write + std::io::Seek>(
    archive: &mut zip::ZipWriter<W>,
    base: &Path,
    file_path: &Path,
    options: &zip::write::FileOptions,
) -> Result<(), IpcError> {
    let relative = file_path.strip_prefix(base).unwrap_or(file_path);
    let name = relative.to_string_lossy().to_string();
    // When base == file_path (single file, no parent dir), strip_prefix returns ""
    let name = if name.is_empty() {
        file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or(name)
    } else {
        name
    };

    archive.start_file(&name, *options).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to add file to archive: {e}"),
    })?;

    let mut f = std::fs::File::open(file_path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to open source file: {e}"),
    })?;

    std::io::copy(&mut f, archive).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to write file to archive: {e}"),
    })?;

    Ok(())
}

// ── Extract logic ───────────────────────────────────────────────────

/// Sanitize an archive entry path to prevent path traversal.
/// Returns an error if the path is absolute, contains `..` that escapes
/// the destination root, or is otherwise unsafe.
fn sanitize_entry_path(entry_name: &str, dest_root: &Path) -> Result<PathBuf, IpcError> {
    // Reject absolute paths
    if Path::new(entry_name).is_absolute() {
        return Err(IpcError {
            code: "path_traversal".to_string(),
            message: format!("archive entry has absolute path: {entry_name}"),
        });
    }

    let canonical_dest = dest_root
        .canonicalize()
        .unwrap_or_else(|_| dest_root.to_path_buf());
    let target = canonical_dest.join(entry_name);

    // Canonicalize may fail if target doesn't exist yet, so normalize manually
    let target = normalize_path(&target);

    // Verify the resolved path is still within dest_root
    if !target.starts_with(&canonical_dest) {
        return Err(IpcError {
            code: "path_traversal".to_string(),
            message: format!("archive entry escapes destination: {entry_name}"),
        });
    }

    Ok(target)
}

/// Normalize a path without requiring it to exist on disk.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                if let Some(last) = components.last() {
                    if *last != std::path::Component::ParentDir {
                        components.pop();
                    } else {
                        components.push(component);
                    }
                } else {
                    components.push(component);
                }
            }
            _ => components.push(component),
        }
    }
    components.iter().collect()
}

/// Simulates the fs_extract_archive handler logic:
/// parse archive URI → open zip → sanitize each entry → extract
fn extract_archive_logic(archive_uri: &str, destination_uri: &str) -> Result<(), IpcError> {
    let src_uri = ResourceUri::parse(archive_uri).map_err(IpcError::from)?;
    let src_path = src_uri.to_local_path().map_err(IpcError::from)?;

    let dest_uri = ResourceUri::parse(destination_uri).map_err(IpcError::from)?;
    let dest_path = dest_uri.to_local_path().map_err(IpcError::from)?;

    if !src_path.exists() {
        return Err(IpcError {
            code: "not_found".to_string(),
            message: format!("archive not found: {}", src_path.display()),
        });
    }

    // Create destination directory
    std::fs::create_dir_all(&dest_path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to create destination directory: {e}"),
    })?;

    let file = std::fs::File::open(&src_path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to open archive: {e}"),
    })?;

    let mut archive = zip::ZipArchive::new(file).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: format!("failed to read archive: {e}"),
    })?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| IpcError {
            code: "io_error".to_string(),
            message: format!("failed to read archive entry {i}: {e}"),
        })?;

        let entry_name = entry.name().to_string();

        // Skip directory entries (they'll be created by files)
        if entry_name.ends_with('/') {
            continue;
        }

        // Sanitize the path to prevent traversal attacks
        let target_path = sanitize_entry_path(&entry_name, &dest_path)?;

        // Create parent directories
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| IpcError {
                code: "io_error".to_string(),
                message: format!("failed to create directory: {e}"),
            })?;
        }

        // Extract the file
        let mut out = std::fs::File::create(&target_path).map_err(|e| IpcError {
            code: "io_error".to_string(),
            message: format!("failed to create file: {e}"),
        })?;

        std::io::copy(&mut entry, &mut out).map_err(|e| IpcError {
            code: "io_error".to_string(),
            message: format!("failed to extract file: {e}"),
        })?;
    }

    Ok(())
}

// ── Compress tests ──────────────────────────────────────────────────

#[test]
fn create_archive_single_file() {
    let dir = temp_dir("compress-single");
    let file_path = dir.join("hello.txt");
    std::fs::write(&file_path, "hello world").unwrap();

    let archive_path = dir.join("output.zip");
    let result = create_archive_logic(&[local_uri(&file_path)], &local_uri(&archive_path));

    assert!(result.is_ok(), "create_archive failed: {:?}", result.err());
    assert!(archive_path.exists());
    // Verify archive is a valid zip
    let file = std::fs::File::open(&archive_path).unwrap();
    let archive = zip::ZipArchive::new(file).unwrap();
    assert_eq!(archive.len(), 1);
}

#[test]
fn create_archive_directory() {
    let dir = temp_dir("compress-dir");
    let sub_dir = dir.join("mydir");
    std::fs::create_dir_all(&sub_dir).unwrap();
    std::fs::write(sub_dir.join("a.txt"), "aaa").unwrap();
    std::fs::write(sub_dir.join("b.txt"), "bbb").unwrap();

    let archive_path = dir.join("output.zip");
    let result = create_archive_logic(&[local_uri(&sub_dir)], &local_uri(&archive_path));

    assert!(result.is_ok(), "create_archive failed: {:?}", result.err());
    let file = std::fs::File::open(&archive_path).unwrap();
    let archive = zip::ZipArchive::new(file).unwrap();
    assert_eq!(archive.len(), 2);
}

#[test]
fn create_archive_multiple_sources() {
    let dir = temp_dir("compress-multi");
    let f1 = dir.join("one.txt");
    let f2 = dir.join("two.txt");
    std::fs::write(&f1, "111").unwrap();
    std::fs::write(&f2, "222").unwrap();

    let archive_path = dir.join("output.zip");
    let result = create_archive_logic(&[local_uri(&f1), local_uri(&f2)], &local_uri(&archive_path));

    assert!(result.is_ok());
    let file = std::fs::File::open(&archive_path).unwrap();
    let archive = zip::ZipArchive::new(file).unwrap();
    assert_eq!(archive.len(), 2);
}

#[test]
fn create_archive_empty_sources_fails() {
    let dir = temp_dir("compress-empty");
    let archive_path = dir.join("output.zip");
    let result = create_archive_logic(&[], &local_uri(&archive_path));
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "invalid_argument");
}

#[test]
fn create_archive_missing_source_fails() {
    let dir = temp_dir("compress-missing");
    let archive_path = dir.join("output.zip");
    let result = create_archive_logic(
        &[local_uri(&dir.join("nonexistent.txt"))],
        &local_uri(&archive_path),
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "not_found");
}

#[test]
fn create_archive_invalid_uri_fails() {
    let dir = temp_dir("compress-bad-uri");
    let result = create_archive_logic(&["bad-uri".to_string()], &local_uri(&dir.join("out.zip")));
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "invalid_uri");
}

// ── Extract tests ──────────────────────────────────────────────────

#[test]
fn extract_archive_simple() {
    let dir = temp_dir("extract-simple");

    // Create a zip first
    let file_path = dir.join("hello.txt");
    std::fs::write(&file_path, "hello world").unwrap();
    let archive_path = dir.join("test.zip");
    create_archive_logic(&[local_uri(&file_path)], &local_uri(&archive_path)).unwrap();

    // Now extract
    let extract_dir = dir.join("extracted");
    let result = extract_archive_logic(&local_uri(&archive_path), &local_uri(&extract_dir));

    assert!(result.is_ok(), "extract failed: {:?}", result.err());
    let extracted = std::fs::read_to_string(extract_dir.join("hello.txt")).unwrap();
    assert_eq!(extracted, "hello world");
}

#[test]
fn extract_archive_with_subdirectory() {
    let dir = temp_dir("extract-subdir");

    // Create a nested structure
    let sub = dir.join("mydir");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("nested.txt"), "nested content").unwrap();

    let archive_path = dir.join("test.zip");
    create_archive_logic(&[local_uri(&sub)], &local_uri(&archive_path)).unwrap();

    let extract_dir = dir.join("extracted");
    let result = extract_archive_logic(&local_uri(&archive_path), &local_uri(&extract_dir));

    assert!(result.is_ok(), "extract failed: {:?}", result.err());
    let extracted = std::fs::read_to_string(extract_dir.join("nested.txt")).unwrap();
    assert_eq!(extracted, "nested content");
}

#[test]
fn extract_archive_not_found_fails() {
    let dir = temp_dir("extract-notfound");
    let result = extract_archive_logic(
        &local_uri(&dir.join("nonexistent.zip")),
        &local_uri(&dir.join("out")),
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "not_found");
}

#[test]
fn extract_archive_rejects_path_traversal() {
    // Test the sanitize function directly
    let dir = temp_dir("extract-traversal");
    std::fs::create_dir_all(&dir).unwrap();

    // Test absolute path rejection
    let result = sanitize_entry_path("/etc/passwd", &dir);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "path_traversal");

    // Test ../  traversal
    let result = sanitize_entry_path("../../../etc/passwd", &dir);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "path_traversal");

    // Test legitimate path passes
    let result = sanitize_entry_path("subdir/file.txt", &dir);
    assert!(result.is_ok());
}

#[test]
fn extract_archive_invalid_uri_fails() {
    let dir = temp_dir("extract-bad-uri");
    let result = extract_archive_logic("bad-uri", &local_uri(&dir.join("out")));
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "invalid_uri");
}

#[test]
fn create_and_extract_roundtrip() {
    let dir = temp_dir("roundtrip");

    // Create files
    let f1 = dir.join("doc.txt");
    let f2 = dir.join("data.bin");
    std::fs::write(&f1, "document content").unwrap();
    std::fs::write(&f2, b"\x00\x01\x02\x03").unwrap();

    // Compress
    let archive_path = dir.join("archive.zip");
    create_archive_logic(&[local_uri(&f1), local_uri(&f2)], &local_uri(&archive_path)).unwrap();

    // Extract
    let extract_dir = dir.join("extracted");
    extract_archive_logic(&local_uri(&archive_path), &local_uri(&extract_dir)).unwrap();

    // Verify
    assert_eq!(
        std::fs::read_to_string(extract_dir.join("doc.txt")).unwrap(),
        "document content"
    );
    assert_eq!(
        std::fs::read(extract_dir.join("data.bin")).unwrap(),
        vec![0u8, 1, 2, 3]
    );
}
