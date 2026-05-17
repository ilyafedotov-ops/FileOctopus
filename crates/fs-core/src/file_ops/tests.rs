use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use jobs::{CancellationToken, JobEvent, JobId};
use tempfile::tempdir;
use vfs::{ConflictPolicy, FileKind, FileOperationKind, FileOperationRequest, ResourceUri};
use zip::write::FileOptions;

use super::execution::PROGRESS_BYTE_INTERVAL;
use super::planning::collect_copy_or_move_items;
use super::{execute_file_operation, plan_file_operation};

fn uri(path: &Path) -> ResourceUri {
    ResourceUri::from_local_path(path).unwrap()
}

fn request(
    kind: FileOperationKind,
    sources: Vec<ResourceUri>,
    destination: Option<ResourceUri>,
) -> FileOperationRequest {
    FileOperationRequest {
        kind,
        sources,
        destination,
        new_name: None,
        conflict_policy: ConflictPolicy::Fail,
    }
}

#[test]
fn planner_rejects_copy_into_itself() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let child = source.join("child");

    fs::create_dir_all(&child).unwrap();

    let error = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&child)),
    ))
    .unwrap_err();

    assert_eq!(error.code(), "recursive_operation");
}

#[test]
fn planner_reports_destination_conflicts() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("a.txt");
    let dest = dir.path().join("dest");

    fs::write(&source, b"a").unwrap();
    fs::create_dir(&dest).unwrap();
    fs::write(dest.join("a.txt"), b"existing").unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();

    assert_eq!(plan.conflicts.len(), 1);
}

#[test]
fn planner_reports_directory_destination_conflicts() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let dest = dir.path().join("dest");

    fs::create_dir(&source).unwrap();
    fs::create_dir(&dest).unwrap();
    fs::create_dir(dest.join("source")).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();

    assert_eq!(plan.conflicts.len(), 1);
}

#[test]
fn planner_reports_missing_source() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("missing.txt");
    let dest = dir.path().join("dest");

    fs::create_dir(&dest).unwrap();

    let error = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap_err();

    assert_eq!(error.code(), "not_found");
}

#[test]
fn planner_reports_missing_destination_parent() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let dest = dir.path().join("missing");

    fs::write(&source, b"a").unwrap();

    let error = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap_err();

    assert_eq!(error.code(), "destination_missing");
}

#[test]
fn collect_copy_or_move_items_uses_cataloged_metadata_warning() {
    let dir = tempdir().unwrap();
    let missing = dir.path().join("missing.txt");
    let destination = dir.path().join("dest");
    let mut items = Vec::new();
    let mut warnings = Vec::new();

    fs::create_dir(&destination).unwrap();

    collect_copy_or_move_items(&missing, &destination, &missing, &mut items, &mut warnings)
        .unwrap();

    assert!(items.is_empty());
    assert_eq!(warnings.len(), 1);
    assert_eq!(
        warnings[0].code,
        vfs::file_operation_warning_codes::METADATA_FAILED
    );
}

#[test]
fn copy_file_produces_identical_content() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("a.txt");
    let dest = dir.path().join("dest");

    fs::write(&source, b"hello").unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(fs::read(dest.join("a.txt")).unwrap(), b"hello");
}

#[test]
fn copy_directory_preserves_structure() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let dest = dir.path().join("dest");

    fs::create_dir_all(source.join("nested")).unwrap();
    fs::write(source.join("nested/file.txt"), b"nested").unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(dest.join("source/nested/file.txt")).unwrap(),
        b"nested"
    );
}

#[test]
fn unicode_paths_copy_move_rename_and_trash_plan_without_lossy_conversion() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("файл 🚀 e\u{301}.txt");
    let dest = dir.path().join("назначение");

    fs::write(&source, b"unicode").unwrap();
    fs::create_dir(&dest).unwrap();

    let copy = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    execute_file_operation(
        &copy,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(dest.join("файл 🚀 e\u{301}.txt")).unwrap(),
        b"unicode"
    );

    let mut rename = request(FileOperationKind::Rename, vec![uri(&source)], None);
    rename.new_name = Some("renamed-ß.txt".to_string());
    let rename = plan_file_operation(rename).unwrap();
    execute_file_operation(
        &rename,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(dir.path().join("renamed-ß.txt").exists());
}

#[cfg(unix)]
#[test]
fn symlink_listing_policy_does_not_recurse_or_copy_link_objects() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let dest = dir.path().join("dest");
    let link = source.join("loop");

    fs::create_dir(&source).unwrap();
    fs::create_dir(&dest).unwrap();
    std::os::unix::fs::symlink(&source, &link).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();

    assert!(plan.items.iter().any(|item| item.kind == FileKind::Symlink));

    let error = execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "unsupported_symlink");
}

#[test]
fn large_file_copy_emits_multiple_progress_updates() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("large.bin");
    let dest = dir.path().join("dest");
    let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::<JobEvent>::new()));
    let events_for_sink = events.clone();

    fs::write(&source, vec![7_u8; (PROGRESS_BYTE_INTERVAL as usize) * 3]).unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &move |event| {
            events_for_sink.lock().unwrap().push(event);
        },
    )
    .unwrap();

    let progress_count = events
        .lock()
        .unwrap()
        .iter()
        .filter(|event| matches!(event, JobEvent::Progress(_)))
        .count();

    assert!(progress_count > 1);
}

#[test]
fn move_file_uses_fast_path_and_removes_source() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("move.txt");
    let dest = dir.path().join("dest");

    fs::write(&source, b"move").unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Move,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(!source.exists());
    assert_eq!(fs::read(dest.join("move.txt")).unwrap(), b"move");
}

#[test]
fn failed_move_conflict_leaves_source_intact() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("move.txt");
    let dest = dir.path().join("dest");

    fs::write(&source, b"source").unwrap();
    fs::create_dir(&dest).unwrap();
    fs::write(dest.join("move.txt"), b"existing").unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Move,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    let error = execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "destination_conflict");
    assert_eq!(fs::read(&source).unwrap(), b"source");
}

#[test]
fn rename_changes_only_basename() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("old.txt");

    fs::write(&source, b"data").unwrap();

    let mut operation = request(FileOperationKind::Rename, vec![uri(&source)], None);
    operation.new_name = Some("new.txt".to_string());
    let plan = plan_file_operation(operation).unwrap();

    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(dir.path().join("new.txt").exists());
    assert!(!source.exists());
}

#[test]
fn open_file_rename_does_not_crash() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("open.txt");

    fs::write(&source, b"data").unwrap();
    let _open_handle = File::open(&source).unwrap();

    let mut operation = request(FileOperationKind::Rename, vec![uri(&source)], None);
    operation.new_name = Some("renamed-open.txt".to_string());
    let plan = plan_file_operation(operation).unwrap();
    let result = execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    );

    if let Err(error) = result {
        assert!(matches!(
            error.code(),
            "permission_denied" | "io_error" | "destination_conflict"
        ));
    }
}

#[test]
fn create_directory_rejects_duplicate() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("new");

    fs::create_dir(&target).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::CreateDirectory,
        Vec::new(),
        Some(uri(&target)),
    ))
    .unwrap();
    let error = execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "destination_conflict");
}

#[test]
fn create_file_creates_empty_file() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("new.txt");

    let plan = plan_file_operation(request(
        FileOperationKind::CreateFile,
        Vec::new(),
        Some(uri(&target)),
    ))
    .unwrap();

    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(target.exists());
    assert_eq!(fs::metadata(&target).unwrap().len(), 0);
}

#[test]
fn delete_permanently_removes_files_and_directories() {
    let dir = tempdir().unwrap();
    let file = dir.path().join("delete-me.txt");
    let folder = dir.path().join("delete-dir");

    fs::write(&file, b"data").unwrap();
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("nested.txt"), b"nested").unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::DeletePermanently,
        vec![uri(&file), uri(&folder)],
        None,
    ))
    .unwrap();

    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(!file.exists());
    assert!(!folder.exists());
}

#[test]
fn create_archive_writes_zip_file() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.zip");

    fs::write(&source, b"archive me").unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::CreateArchive,
        vec![uri(&source)],
        Some(uri(&archive_path)),
    ))
    .unwrap();

    execute_file_operation(
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    let file = File::open(&archive_path).unwrap();
    let archive = zip::ZipArchive::new(file).unwrap();

    assert_eq!(archive.len(), 1);
}

#[test]
fn extract_archive_writes_files_to_destination() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.zip");
    let extract_dir = dir.path().join("out");

    fs::write(&source, b"archive me").unwrap();

    let create_plan = plan_file_operation(request(
        FileOperationKind::CreateArchive,
        vec![uri(&source)],
        Some(uri(&archive_path)),
    ))
    .unwrap();
    execute_file_operation(
        &create_plan,
        &JobId::new("job-create"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    let extract_plan = plan_file_operation(request(
        FileOperationKind::ExtractArchive,
        vec![uri(&archive_path)],
        Some(uri(&extract_dir)),
    ))
    .unwrap();
    execute_file_operation(
        &extract_plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(extract_dir.join("source.txt")).unwrap(),
        b"archive me"
    );
}

#[test]
fn extract_archive_rejects_path_traversal_entries() {
    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("bad.zip");
    let extract_dir = dir.path().join("out");
    let file = File::create(&archive_path).unwrap();
    let mut archive = zip::ZipWriter::new(file);

    archive
        .start_file("../escape.txt", FileOptions::default())
        .unwrap();
    archive.write_all(b"nope").unwrap();
    archive.finish().unwrap();

    let error = plan_file_operation(request(
        FileOperationKind::ExtractArchive,
        vec![uri(&archive_path)],
        Some(uri(&extract_dir)),
    ))
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
}

#[test]
fn cancellation_stops_large_copy() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("large.bin");
    let dest = dir.path().join("dest");
    let cancel = CancellationToken::new();

    fs::write(&source, vec![7_u8; (PROGRESS_BYTE_INTERVAL as usize) * 2]).unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    let token = cancel.clone();
    let result = execute_file_operation(&plan, &JobId::new("job"), &cancel, &move |_| {
        token.cancel();
    });

    assert_eq!(result.unwrap_err().code(), "cancelled");
}

#[test]
fn cancellation_stops_many_small_file_copy() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let dest = dir.path().join("dest");
    let cancel = CancellationToken::new();

    fs::create_dir(&source).unwrap();
    fs::create_dir(&dest).unwrap();
    for index in 0..50 {
        fs::write(source.join(format!("file-{index}.txt")), b"x").unwrap();
    }

    let plan = plan_file_operation(request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&dest)),
    ))
    .unwrap();
    let token = cancel.clone();
    let result = execute_file_operation(&plan, &JobId::new("job"), &cancel, &move |_| {
        token.cancel();
    });

    assert_eq!(result.unwrap_err().code(), "cancelled");
}
