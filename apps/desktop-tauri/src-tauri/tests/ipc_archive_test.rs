//! Integration tests for fs_list_archive command logic.

use std::io::Write;
use std::path::PathBuf;

use app_ipc::{error_codes, FileEntryDto, IpcError};
use vfs::{FileKind, ResourceUri};

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-archive-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Simulates the fs_list_archive handler logic:
/// parse URI → check metadata → verify file exists → detect format → list entries
fn list_archive_logic(uri_str: &str) -> Result<Vec<FileEntryDto>, IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            IpcError::not_found(path.to_string_lossy().to_string())
        } else {
            IpcError::io(e.to_string())
        }
    })?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory(
            "cannot list archive contents of a directory",
        ));
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
        .to_lowercase();

    if name.ends_with(".zip") {
        list_zip(&path)
    } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        list_tar_gz(&path)
    } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") {
        list_tar_bz2(&path)
    } else if name.ends_with(".tar") {
        list_tar(&path)
    } else {
        Err(IpcError::invalid_request(format!(
            "unsupported archive format: {name}"
        )))
    }
}

fn list_zip(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| IpcError::io(format!("failed to read zip archive: {e}")))?;

    let mut entries = Vec::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|e| IpcError::io(format!("failed to read zip entry {index}: {e}")))?;
        let entry_name = entry.name().to_string();
        let is_dir = entry_name.ends_with('/');
        let name = entry_name
            .trim_end_matches('/')
            .split('/')
            .last()
            .unwrap_or("")
            .to_string();

        if name.is_empty() {
            continue;
        }

        let uri = format!("archive://{}!/{}", path.display(), entry_name);

        entries.push(FileEntryDto {
            uri,
            name,
            extension: extension_for_name(&entry_name, is_dir),
            kind: if is_dir {
                FileKind::Directory
            } else {
                FileKind::File
            },
            size: if is_dir { None } else { Some(entry.size()) },
            modified_at: Some({
                let dt = entry.last_modified();
                chrono::NaiveDateTime::new(
                    chrono::NaiveDate::from_ymd_opt(
                        dt.year() as i32,
                        dt.month() as u32,
                        dt.day() as u32,
                    )
                    .unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap()),
                    chrono::NaiveTime::from_hms_opt(
                        dt.hour() as u32,
                        dt.minute() as u32,
                        dt.second() as u32,
                    )
                    .unwrap_or_else(|| chrono::NaiveTime::from_hms_opt(0, 0, 0).unwrap()),
                )
                .and_utc()
            }),
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            symlink_target: None,
            provider_id: "local".to_string(),
            can_read: true,
            can_list: is_dir,
            can_write: false,
            can_delete: false,
            can_rename: false,
            permissions: None,
            owner: None,
        });
    }

    Ok(entries)
}

fn list_tar_entries<R: std::io::Read>(
    archive: &mut tar::Archive<R>,
) -> Result<Vec<FileEntryDto>, IpcError> {
    let mut entries = Vec::new();
    let iter = archive
        .entries()
        .map_err(|e| IpcError::io(format!("failed to read tar entries: {e}")))?;

    for entry_result in iter {
        let entry =
            entry_result.map_err(|e| IpcError::io(format!("failed to read tar entry: {e}")))?;
        let entry_path = entry
            .path()
            .map_err(|e| IpcError::io(format!("failed to read tar entry path: {e}")))?;
        let entry_name = entry_path.to_string_lossy().to_string();
        let is_dir = entry_name.ends_with('/');
        let name = entry_name
            .trim_end_matches('/')
            .split('/')
            .last()
            .unwrap_or("")
            .to_string();

        if name.is_empty() {
            continue;
        }

        let uri = format!("archive://{}!/{}", "", entry_name);
        let header = entry.header();

        entries.push(FileEntryDto {
            uri,
            name,
            extension: extension_for_name(&entry_name, is_dir),
            kind: if is_dir {
                FileKind::Directory
            } else {
                FileKind::File
            },
            size: if is_dir { None } else { Some(entry.size()) },
            modified_at: header
                .mtime()
                .ok()
                .map(|ts| chrono::DateTime::from_timestamp(ts as i64, 0).unwrap_or_default()),
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: entry.link_name().ok().flatten().is_some(),
            symlink_target: entry
                .link_name()
                .ok()
                .flatten()
                .map(|p| p.to_string_lossy().to_string()),
            provider_id: "local".to_string(),
            can_read: true,
            can_list: is_dir,
            can_write: false,
            can_delete: false,
            can_rename: false,
            permissions: None,
            owner: None,
        });
    }

    Ok(entries)
}

fn list_tar_gz(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let gz = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz);
    list_tar_entries(&mut archive)
}

fn list_tar_bz2(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let bz = bzip2::read::BzDecoder::new(file);
    let mut archive = tar::Archive::new(bz);
    list_tar_entries(&mut archive)
}

fn list_tar(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let mut archive = tar::Archive::new(file);
    list_tar_entries(&mut archive)
}

fn extension_for_name(name: &str, is_dir: bool) -> Option<String> {
    if is_dir {
        return None;
    }
    let file_name = name.trim_end_matches('/');
    let file_name = file_name.split('/').last().unwrap_or(file_name);
    std::path::Path::new(file_name)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
}

fn make_test_zip(dir: &std::path::Path) -> PathBuf {
    let zip_path = dir.join("test.zip");
    let file = std::fs::File::create(&zip_path).unwrap();
    let mut zip_writer = zip::ZipWriter::new(file);
    let options =
        zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip_writer.start_file("hello.txt", options.clone()).unwrap();
    zip_writer.write_all(b"hello world").unwrap();

    zip_writer
        .start_file("subdir/nested.txt", options.clone())
        .unwrap();
    zip_writer.write_all(b"nested content").unwrap();

    zip_writer
        .add_directory("empty_dir/", options.clone())
        .unwrap();

    zip_writer.finish().unwrap();
    zip_path
}

fn make_test_tar(dir: &std::path::Path) -> PathBuf {
    let tar_path = dir.join("test.tar");
    let file = std::fs::File::create(&tar_path).unwrap();
    let mut builder = tar::Builder::new(file);

    let mut header = tar::Header::new_gnu();
    header.set_size(5);
    header.set_cksum();
    builder
        .append_data(&mut header, "a.txt", std::io::Cursor::new(b"hello"))
        .unwrap();

    let mut header2 = tar::Header::new_gnu();
    header2.set_size(0);
    header2.set_entry_type(tar::EntryType::Directory);
    header2.set_cksum();
    builder
        .append_data(&mut header2, "subdir/", std::io::empty())
        .unwrap();

    builder.finish().unwrap();
    tar_path
}

fn make_test_tar_gz(dir: &std::path::Path) -> PathBuf {
    let tar_gz_path = dir.join("test.tar.gz");
    let file = std::fs::File::create(&tar_gz_path).unwrap();
    let gz = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut builder = tar::Builder::new(gz);

    let mut header = tar::Header::new_gnu();
    header.set_size(3);
    header.set_cksum();
    builder
        .append_data(&mut header, "b.txt", std::io::Cursor::new(b"abc"))
        .unwrap();

    builder.finish().unwrap();
    tar_gz_path
}

#[test]
fn list_archive_zip_returns_entries() {
    let dir = temp_dir("zip");
    let zip_path = make_test_zip(&dir);
    let uri = format!("local://{}", zip_path.display());

    let result = list_archive_logic(&uri).unwrap();

    assert!(
        result.len() >= 3,
        "expected at least 3 entries, got {}",
        result.len()
    );

    let names: Vec<&str> = result.iter().map(|e| e.name.as_str()).collect();
    assert!(
        names.contains(&"hello.txt"),
        "expected hello.txt in {:?}",
        names
    );
    assert!(
        names.contains(&"nested.txt"),
        "expected nested.txt in {:?}",
        names
    );
    assert!(
        names.contains(&"empty_dir"),
        "expected empty_dir in {:?}",
        names
    );

    let hello_entry = result.iter().find(|e| e.name == "hello.txt").unwrap();
    assert_eq!(hello_entry.kind, FileKind::File);
    assert_eq!(hello_entry.size, Some(11));
    assert_eq!(hello_entry.extension, Some("txt".to_string()));
    assert!(hello_entry.uri.contains("hello.txt"));

    let dir_entry = result.iter().find(|e| e.name == "empty_dir").unwrap();
    assert_eq!(dir_entry.kind, FileKind::Directory);
    assert_eq!(dir_entry.size, None);
}

#[test]
fn list_archive_tar_returns_entries() {
    let dir = temp_dir("tar");
    let tar_path = make_test_tar(&dir);
    let uri = format!("local://{}", tar_path.display());

    let result = list_archive_logic(&uri).unwrap();

    assert!(
        result.len() >= 2,
        "expected at least 2 entries, got {}",
        result.len()
    );

    let names: Vec<&str> = result.iter().map(|e| e.name.as_str()).collect();
    assert!(names.contains(&"a.txt"), "expected a.txt in {:?}", names);
    assert!(names.contains(&"subdir"), "expected subdir in {:?}", names);

    let file_entry = result.iter().find(|e| e.name == "a.txt").unwrap();
    assert_eq!(file_entry.kind, FileKind::File);
    assert_eq!(file_entry.size, Some(5));
}

#[test]
fn list_archive_tar_gz_returns_entries() {
    let dir = temp_dir("targz");
    let tar_gz_path = make_test_tar_gz(&dir);
    let uri = format!("local://{}", tar_gz_path.display());

    let result = list_archive_logic(&uri).unwrap();

    assert!(!result.is_empty(), "expected at least 1 entry");

    let file_entry = result.iter().find(|e| e.name == "b.txt").unwrap();
    assert_eq!(file_entry.kind, FileKind::File);
    assert_eq!(file_entry.size, Some(3));
}

#[test]
fn list_archive_directory_returns_error() {
    let dir = temp_dir("dir");
    let uri = format!("local://{}", dir.display());

    let result = list_archive_logic(&uri);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::IS_DIRECTORY);
}

#[test]
fn list_archive_missing_file_returns_error() {
    let dir = temp_dir("missing");
    let missing = dir.join("nonexistent.zip");
    let uri = format!("local://{}", missing.display());

    let result = list_archive_logic(&uri);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::NOT_FOUND);
}

#[test]
fn list_archive_unsupported_format_returns_error() {
    let dir = temp_dir("unsup");
    let file_path = dir.join("test.rar");
    std::fs::write(&file_path, b"not an archive").unwrap();
    let uri = format!("local://{}", file_path.display());

    let result = list_archive_logic(&uri);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, error_codes::INVALID_REQUEST);
}
