use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::sync::Arc;

use jobs::{CancellationToken, JobEvent, JobId, PauseToken};
use tempfile::tempdir;
use vfs::{
    BatchRenameItem, ConflictPolicy, FileKind, FileOperationKind, FileOperationRequest,
    ResourceUri, VfsRegistry,
};
use zip::write::SimpleFileOptions;

use super::archive::validate_archive_budget_for_test;
use super::execution::PROGRESS_BYTE_INTERVAL;
use super::planning::collect_copy_or_move_items;
use crate::vfs_io::VfsFilesystem;
use crate::LocalFsProvider;

use super::{execute_file_operation, plan_file_operation};

fn vfs() -> VfsFilesystem {
    let registry = Arc::new(VfsRegistry::new());
    registry.register(Arc::new(LocalFsProvider::new())).unwrap();
    VfsFilesystem::local_only(registry)
}

fn batch_rename_request(entries: &[(&Path, &str)]) -> FileOperationRequest {
    let batch_renames = entries
        .iter()
        .map(|(source, new_name)| BatchRenameItem {
            source: uri(source),
            new_name: (*new_name).to_string(),
        })
        .collect::<Vec<_>>();
    FileOperationRequest {
        kind: FileOperationKind::BatchRename,
        sources: batch_renames
            .iter()
            .map(|rename| rename.source.clone())
            .collect(),
        destination: None,
        new_name: None,
        conflict_policy: ConflictPolicy::Fail,
        batch_renames,
    }
}

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
        batch_renames: Vec::new(),
    }
}

fn write_zip_entry(path: &Path, entry_name: &str, contents: &[u8]) {
    let file = File::create(path).unwrap();
    let mut archive = zip::ZipWriter::new(file);
    archive
        .start_file(entry_name, SimpleFileOptions::default())
        .unwrap();
    archive.write_all(contents).unwrap();
    archive.finish().unwrap();
}

#[test]
fn planner_rejects_copy_into_itself() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let child = source.join("child");

    fs::create_dir_all(&child).unwrap();

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&child)),
        ),
    )
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();

    assert_eq!(plan.conflicts.len(), 1);
}

#[test]
fn planner_reports_missing_source() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("missing.txt");
    let dest = dir.path().join("dest");

    fs::create_dir(&dest).unwrap();

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap_err();

    assert_eq!(error.code(), "not_found");
}

#[test]
fn planner_reports_missing_destination_parent() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let dest = dir.path().join("missing");

    fs::write(&source, b"a").unwrap();

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap_err();

    assert_eq!(error.code(), "destination_missing");
}

#[test]
fn planner_rejects_metadata_job_kinds() {
    for kind in [
        FileOperationKind::FolderSize,
        FileOperationKind::RecursiveSearch,
        FileOperationKind::ContentSearch,
    ] {
        let error = plan_file_operation(&vfs(), request(kind, Vec::new(), None)).unwrap_err();

        assert_eq!(error.code(), "invalid_request");
    }
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let copy = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &copy,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(dest.join("файл 🚀 e\u{301}.txt")).unwrap(),
        b"unicode"
    );

    let mut rename = request(FileOperationKind::Rename, vec![uri(&source)], None);
    rename.new_name = Some("renamed-ß.txt".to_string());
    let rename = plan_file_operation(&vfs(), rename).unwrap();
    execute_file_operation(
        &vfs(),
        &rename,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(dir.path().join("renamed-ß.txt").exists());
}

#[cfg(unix)]
#[test]
fn local_copy_preserves_symlink_object_without_recursing_into_target() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    let dest = dir.path().join("dest");
    let link = source.join("loop");

    fs::create_dir(&source).unwrap();
    fs::create_dir(&dest).unwrap();
    std::os::unix::fs::symlink(&source, &link).unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();

    assert!(plan.items.iter().any(|item| item.kind == FileKind::Symlink));

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    let copied_link = dest.join("source").join("loop");
    let copied_metadata = fs::symlink_metadata(&copied_link).unwrap();
    assert!(copied_metadata.file_type().is_symlink());
    assert_eq!(fs::read_link(copied_link).unwrap(), source);
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Move,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(!source.exists());
    assert_eq!(fs::read(dest.join("move.txt")).unwrap(), b"move");
}

#[test]
fn multi_source_move_skip_retains_conflicting_source() {
    let dir = tempdir().unwrap();
    let conflicting_source = dir.path().join("a.txt");
    let moved_source = dir.path().join("b.txt");
    let dest = dir.path().join("dest");

    fs::write(&conflicting_source, b"source-a").unwrap();
    fs::write(&moved_source, b"source-b").unwrap();
    fs::create_dir(&dest).unwrap();
    fs::write(dest.join("a.txt"), b"existing-a").unwrap();

    let mut operation = request(
        FileOperationKind::Move,
        vec![uri(&conflicting_source), uri(&moved_source)],
        Some(uri(&dest)),
    );
    operation.conflict_policy = ConflictPolicy::Skip;
    let plan = plan_file_operation(&vfs(), operation).unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(fs::read(&conflicting_source).unwrap(), b"source-a");
    assert_eq!(fs::read(dest.join("a.txt")).unwrap(), b"existing-a");
    assert!(!moved_source.exists());
    assert_eq!(fs::read(dest.join("b.txt")).unwrap(), b"source-b");
}

#[test]
fn multi_source_move_skip_retains_entire_source_root() {
    let dir = tempdir().unwrap();
    let source_root = dir.path().join("source");
    let moved_source = dir.path().join("z.txt");
    let dest = dir.path().join("dest");

    fs::create_dir(&source_root).unwrap();
    fs::write(source_root.join("conflict.txt"), b"source-conflict").unwrap();
    fs::write(source_root.join("copied.txt"), b"source-copied").unwrap();
    fs::write(&moved_source, b"source-z").unwrap();
    fs::create_dir_all(dest.join("source")).unwrap();
    fs::write(dest.join("source/conflict.txt"), b"existing-conflict").unwrap();

    let mut operation = request(
        FileOperationKind::Move,
        vec![uri(&source_root), uri(&moved_source)],
        Some(uri(&dest)),
    );
    operation.conflict_policy = ConflictPolicy::Skip;
    let plan = plan_file_operation(&vfs(), operation).unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(source_root.join("conflict.txt")).unwrap(),
        b"source-conflict"
    );
    assert_eq!(
        fs::read(source_root.join("copied.txt")).unwrap(),
        b"source-copied"
    );
    assert_eq!(
        fs::read(dest.join("source/conflict.txt")).unwrap(),
        b"existing-conflict"
    );
    assert_eq!(
        fs::read(dest.join("source/copied.txt")).unwrap(),
        b"source-copied"
    );
    assert!(!moved_source.exists());
    assert_eq!(fs::read(dest.join("z.txt")).unwrap(), b"source-z");
}

#[test]
fn multi_source_move_late_conflict_failure_retains_all_sources() {
    let dir = tempdir().unwrap();
    let first_source = dir.path().join("a.txt");
    let failed_source = dir.path().join("b.txt");
    let dest = dir.path().join("dest");

    fs::write(&first_source, b"source-a").unwrap();
    fs::write(&failed_source, b"source-b").unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Move,
            vec![uri(&first_source), uri(&failed_source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    fs::write(dest.join("b.txt"), b"late-conflict").unwrap();

    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "destination_conflict");
    assert_eq!(fs::read(&first_source).unwrap(), b"source-a");
    assert_eq!(fs::read(&failed_source).unwrap(), b"source-b");
    assert_eq!(fs::read(dest.join("a.txt")).unwrap(), b"source-a");
    assert_eq!(fs::read(dest.join("b.txt")).unwrap(), b"late-conflict");
}

#[test]
fn multi_source_move_removes_successfully_copied_sources() {
    let dir = tempdir().unwrap();
    let first_source = dir.path().join("source");
    let second_source = dir.path().join("b.txt");
    let dest = dir.path().join("dest");

    fs::create_dir_all(first_source.join("nested")).unwrap();
    fs::write(first_source.join("nested/a.txt"), b"source-a").unwrap();
    fs::write(&second_source, b"source-b").unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Move,
            vec![uri(&first_source), uri(&second_source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(!first_source.exists());
    assert!(!second_source.exists());
    assert_eq!(
        fs::read(dest.join("source/nested/a.txt")).unwrap(),
        b"source-a"
    );
    assert_eq!(fs::read(dest.join("b.txt")).unwrap(), b"source-b");
}

#[test]
fn failed_move_conflict_leaves_source_intact() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("move.txt");
    let dest = dir.path().join("dest");

    fs::write(&source, b"source").unwrap();
    fs::create_dir(&dest).unwrap();
    fs::write(dest.join("move.txt"), b"existing").unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Move,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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
    let plan = plan_file_operation(&vfs(), operation).unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert!(dir.path().join("new.txt").exists());
    assert!(!source.exists());
}

#[test]
fn rename_honors_overwrite_skip_and_rename_conflict_policies() {
    for (policy, expected_destination, expected_source, expected_alternate) in [
        (ConflictPolicy::Overwrite, b"source".as_slice(), None, None),
        (
            ConflictPolicy::Skip,
            b"destination".as_slice(),
            Some(b"source".as_slice()),
            None,
        ),
        (
            ConflictPolicy::RenameNew,
            b"destination".as_slice(),
            None,
            Some(b"source".as_slice()),
        ),
        (
            ConflictPolicy::RenameExisting,
            b"source".as_slice(),
            None,
            Some(b"destination".as_slice()),
        ),
    ] {
        let dir = tempdir().unwrap();
        let source = dir.path().join("old.txt");
        let destination = dir.path().join("new.txt");
        let alternate = dir.path().join("new (1).txt");
        fs::write(&source, b"source").unwrap();
        fs::write(&destination, b"destination").unwrap();

        let mut operation = request(FileOperationKind::Rename, vec![uri(&source)], None);
        operation.new_name = Some("new.txt".to_string());
        operation.conflict_policy = policy;
        let plan = plan_file_operation(&vfs(), operation).unwrap();
        execute_file_operation(
            &vfs(),
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &PauseToken::new(),
            &|_| {},
        )
        .unwrap();

        assert_eq!(fs::read(&destination).unwrap(), expected_destination);
        assert_eq!(
            source.exists().then(|| fs::read(&source).unwrap()),
            expected_source.map(Vec::from)
        );
        assert_eq!(
            alternate.exists().then(|| fs::read(&alternate).unwrap()),
            expected_alternate.map(Vec::from)
        );
    }
}

#[test]
fn cancelled_overwrite_copy_preserves_existing_destination() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let destination_dir = dir.path().join("destination");
    let destination = destination_dir.join("source.txt");
    fs::create_dir(&destination_dir).unwrap();
    fs::write(&source, vec![b'x'; 128 * 1024]).unwrap();
    fs::write(&destination, b"existing").unwrap();

    let mut operation = request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&destination_dir)),
    );
    operation.conflict_policy = ConflictPolicy::Overwrite;
    let plan = plan_file_operation(&vfs(), operation).unwrap();
    let cancel = CancellationToken::new();
    cancel.cancel();

    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &cancel,
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "cancelled");
    assert_eq!(fs::read(&destination).unwrap(), b"existing");
    assert_eq!(fs::read(&source).unwrap().len(), 128 * 1024);
    assert!(!fs::read_dir(&destination_dir).unwrap().any(|entry| {
        entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".fileoctopus-copy-")
    }));
}

#[test]
fn overwrite_copy_commits_only_after_staging_completes() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let destination_dir = dir.path().join("destination");
    let destination = destination_dir.join("source.txt");
    fs::create_dir(&destination_dir).unwrap();
    fs::write(&source, b"replacement").unwrap();
    fs::write(&destination, b"existing").unwrap();

    let mut operation = request(
        FileOperationKind::Copy,
        vec![uri(&source)],
        Some(uri(&destination_dir)),
    );
    operation.conflict_policy = ConflictPolicy::Overwrite;
    let plan = plan_file_operation(&vfs(), operation).unwrap();
    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(fs::read(&destination).unwrap(), b"replacement");
    assert_eq!(fs::read(&source).unwrap(), b"replacement");
}

#[test]
fn batch_rename_executes_a_three_item_cycle_without_data_loss() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first.txt");
    let second = dir.path().join("second.txt");
    let third = dir.path().join("third.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();
    fs::write(&third, b"third").unwrap();

    let plan = plan_file_operation(
        &vfs(),
        batch_rename_request(&[
            (&first, "second.txt"),
            (&second, "third.txt"),
            (&third, "first.txt"),
        ]),
    )
    .unwrap();
    assert!(plan.conflicts.is_empty());

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("batch-cycle"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(fs::read(&first).unwrap(), b"third");
    assert_eq!(fs::read(&second).unwrap(), b"first");
    assert_eq!(fs::read(&third).unwrap(), b"second");
    assert!(!fs::read_dir(dir.path()).unwrap().any(|entry| {
        entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".fileoctopus-batch-rename-")
    }));
}

#[test]
fn batch_rename_executes_a_two_item_swap() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first.txt");
    let second = dir.path().join("second.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();
    let plan = plan_file_operation(
        &vfs(),
        batch_rename_request(&[(&first, "second.txt"), (&second, "first.txt")]),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("batch-swap"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(fs::read(&first).unwrap(), b"second");
    assert_eq!(fs::read(&second).unwrap(), b"first");
}

#[test]
fn batch_rename_rejects_duplicate_and_external_destinations() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first.txt");
    let second = dir.path().join("second.txt");
    let external = dir.path().join("external.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();
    fs::write(&external, b"external").unwrap();

    let duplicate = plan_file_operation(
        &vfs(),
        batch_rename_request(&[(&first, "same.txt"), (&second, "same.txt")]),
    )
    .unwrap_err();
    assert_eq!(duplicate.code(), "destination_conflict");

    let external_conflict =
        plan_file_operation(&vfs(), batch_rename_request(&[(&first, "external.txt")])).unwrap_err();
    assert_eq!(external_conflict.code(), "destination_conflict");
    assert_eq!(fs::read(&external).unwrap(), b"external");

    let invalid_name =
        plan_file_operation(&vfs(), batch_rename_request(&[(&first, "nested/name.txt")]))
            .unwrap_err();
    assert_eq!(invalid_name.code(), "invalid_name");
}

#[test]
fn batch_rename_rejects_sources_from_different_parents() {
    let dir = tempdir().unwrap();
    let left = dir.path().join("left");
    let right = dir.path().join("right");
    fs::create_dir(&left).unwrap();
    fs::create_dir(&right).unwrap();
    let first = left.join("first.txt");
    let second = right.join("second.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();

    let error = plan_file_operation(
        &vfs(),
        batch_rename_request(&[
            (&first, "renamed-first.txt"),
            (&second, "renamed-second.txt"),
        ]),
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
}

#[test]
fn cancelled_batch_rename_rolls_back_committed_items_and_removes_temporaries() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first.txt");
    let second = dir.path().join("second.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();
    let plan = plan_file_operation(
        &vfs(),
        batch_rename_request(&[(&first, "second.txt"), (&second, "first.txt")]),
    )
    .unwrap();
    let cancel = CancellationToken::new();
    let token = cancel.clone();

    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("batch-cancel"),
        &cancel,
        &PauseToken::new(),
        &move |event| {
            if matches!(event, JobEvent::Progress(progress) if progress.completed_items == 1) {
                token.cancel();
            }
        },
    )
    .unwrap_err();

    assert_eq!(error.code(), "cancelled");
    assert_eq!(fs::read(&first).unwrap(), b"first");
    assert_eq!(fs::read(&second).unwrap(), b"second");
    assert!(!fs::read_dir(dir.path()).unwrap().any(|entry| {
        entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".fileoctopus-batch-rename-")
    }));
}

#[test]
fn batch_rename_reports_incomplete_rollback_without_clobbering_new_data() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first.txt");
    let second = dir.path().join("second.txt");
    fs::write(&first, b"first").unwrap();
    fs::write(&second, b"second").unwrap();
    let plan = plan_file_operation(
        &vfs(),
        batch_rename_request(&[(&first, "second.txt"), (&second, "first.txt")]),
    )
    .unwrap();
    let cancel = CancellationToken::new();
    let token = cancel.clone();
    let first_for_sink = first.clone();

    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("batch-rollback-conflict"),
        &cancel,
        &PauseToken::new(),
        &move |event| {
            if matches!(event, JobEvent::Progress(progress) if progress.completed_items == 1) {
                fs::write(&first_for_sink, b"new data").unwrap();
                token.cancel();
            }
        },
    )
    .unwrap_err();

    assert_eq!(error.code(), "io_error");
    assert!(error.user_message().contains("rollback incomplete"));
    assert_eq!(fs::read(&first).unwrap(), b"new data");
    assert_eq!(fs::read(&second).unwrap(), b"second");
    let temporary = fs::read_dir(dir.path())
        .unwrap()
        .map(Result::unwrap)
        .find(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with(".fileoctopus-batch-rename-")
        })
        .unwrap();
    assert_eq!(fs::read(temporary.path()).unwrap(), b"first");
}

#[test]
fn no_replace_rename_preserves_an_existing_destination() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let destination = dir.path().join("destination.txt");
    fs::write(&source, b"source").unwrap();
    fs::write(&destination, b"destination").unwrap();

    super::execution::rename_no_replace(&source, &destination).unwrap_err();

    assert_eq!(fs::read(&source).unwrap(), b"source");
    assert_eq!(fs::read(&destination).unwrap(), b"destination");
}

#[test]
fn open_file_rename_does_not_crash() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("open.txt");

    fs::write(&source, b"data").unwrap();
    let _open_handle = File::open(&source).unwrap();

    let mut operation = request(FileOperationKind::Rename, vec![uri(&source)], None);
    operation.new_name = Some("renamed-open.txt".to_string());
    let plan = plan_file_operation(&vfs(), operation).unwrap();
    let result = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::CreateDirectory,
            Vec::new(),
            Some(uri(&target)),
        ),
    )
    .unwrap();
    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "destination_conflict");
}

#[test]
fn create_file_creates_empty_file() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("new.txt");

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::CreateFile,
            Vec::new(),
            Some(uri(&target)),
        ),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::DeletePermanently,
            vec![uri(&file), uri(&folder)],
            None,
        ),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::CreateArchive,
            vec![uri(&source)],
            Some(uri(&archive_path)),
        ),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
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

    let create_plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::CreateArchive,
            vec![uri(&source)],
            Some(uri(&archive_path)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &create_plan,
        &JobId::new("job-create"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    let extract_plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &extract_plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
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
        .start_file("../escape.txt", SimpleFileOptions::default())
        .unwrap();
    archive.write_all(b"nope").unwrap();
    archive.finish().unwrap();

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
}

#[test]
fn extract_archive_rejects_source_changed_after_planning() {
    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("changed.zip");
    let extract_dir = dir.path().join("out");
    write_zip_entry(&archive_path, "source.txt", b"before");

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    write_zip_entry(&archive_path, "source.txt", b"after!");

    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
    assert!(!extract_dir.exists());
}

#[test]
fn extract_archive_revalidates_planned_destination() {
    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("archive.zip");
    let extract_dir = dir.path().join("out");
    let outside = dir.path().join("outside.txt");
    write_zip_entry(&archive_path, "source.txt", b"content");

    let mut plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    plan.items[0].destination = Some(uri(&outside));

    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
    assert!(!outside.exists());
    assert!(!extract_dir.exists());
}

#[cfg(unix)]
#[test]
fn extract_archive_rejects_symlink_destination_component() {
    use std::os::unix::fs::symlink;

    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("archive.zip");
    let extract_dir = dir.path().join("out");
    let outside_dir = dir.path().join("outside");
    write_zip_entry(&archive_path, "nested/escape.txt", b"blocked");
    fs::create_dir(&extract_dir).unwrap();
    fs::create_dir(&outside_dir).unwrap();
    symlink(&outside_dir, extract_dir.join("nested")).unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
    assert!(!outside_dir.join("escape.txt").exists());
}

#[cfg(unix)]
#[test]
fn extract_archive_rejects_symlink_destination_root() {
    use std::os::unix::fs::symlink;

    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("archive.zip");
    let extract_dir = dir.path().join("out");
    let outside_dir = dir.path().join("outside");
    write_zip_entry(&archive_path, "escape.txt", b"blocked");
    fs::create_dir(&outside_dir).unwrap();
    symlink(&outside_dir, &extract_dir).unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
    assert!(!outside_dir.join("escape.txt").exists());
}

#[cfg(unix)]
#[test]
fn extract_archive_overwrite_rejects_symlink_destination_file() {
    use std::os::unix::fs::symlink;

    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("archive.zip");
    let extract_dir = dir.path().join("out");
    let outside_file = dir.path().join("outside.txt");
    write_zip_entry(&archive_path, "source.txt", b"replacement");
    fs::create_dir(&extract_dir).unwrap();
    fs::write(&outside_file, b"keep me").unwrap();
    symlink(&outside_file, extract_dir.join("source.txt")).unwrap();
    let mut extract_request = request(
        FileOperationKind::ExtractArchive,
        vec![uri(&archive_path)],
        Some(uri(&extract_dir)),
    );
    extract_request.conflict_policy = ConflictPolicy::Overwrite;

    let plan = plan_file_operation(&vfs(), extract_request).unwrap();
    let error = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
    assert_eq!(fs::read(&outside_file).unwrap(), b"keep me");
}

#[test]
fn extract_archive_rejects_excessive_path_depth() {
    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("deep.zip");
    let extract_dir = dir.path().join("out");
    let entry_name = format!("{}file.txt", "directory/".repeat(129));
    write_zip_entry(&archive_path, &entry_name, b"blocked");

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
}

#[test]
fn extract_archive_rejects_extreme_compression_ratio() {
    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("bomb.zip");
    let extract_dir = dir.path().join("out");
    let file = File::create(&archive_path).unwrap();
    let mut archive = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    archive.start_file("zeros.bin", options).unwrap();
    archive.write_all(&vec![0_u8; 16 * 1024 * 1024]).unwrap();
    archive.finish().unwrap();

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
}

#[test]
fn extract_archive_enforces_entry_count_and_expanded_size_limits() {
    assert!(validate_archive_budget_for_test(100_001, 0, Some(0), 1).is_err());
    assert!(validate_archive_budget_for_test(
        1,
        16 * 1024 * 1024 * 1024 + 1,
        None,
        100 * 1024 * 1024 * 1024,
    )
    .is_err());
    assert!(validate_archive_budget_for_test(
        7,
        16 * 1024 * 1024 * 1024,
        None,
        100 * 1024 * 1024 * 1024,
    )
    .is_err());
    assert!(validate_archive_budget_for_test(1, 1_001, Some(1), 1_001).is_err());
}

#[test]
fn extract_archive_rejects_tar_symlink_entries() {
    let dir = tempdir().unwrap();
    let archive_path = dir.path().join("links.tar");
    let extract_dir = dir.path().join("out");
    let file = File::create(&archive_path).unwrap();
    let mut archive = tar::Builder::new(file);
    let mut header = tar::Header::new_gnu();
    header.set_entry_type(tar::EntryType::Symlink);
    header.set_size(0);
    archive
        .append_link(&mut header, "link", "../outside")
        .unwrap();
    archive.finish().unwrap();

    let error = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap_err();

    assert_eq!(error.code(), "invalid_request");
}

#[test]
fn extract_tar_archive_writes_files_to_destination() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.tar");
    let extract_dir = dir.path().join("out");
    fs::write(&source, b"archive me").unwrap();
    let file = File::create(&archive_path).unwrap();
    let mut archive = tar::Builder::new(file);
    archive
        .append_path_with_name(&source, "source.txt")
        .unwrap();
    archive.finish().unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(extract_dir.join("source.txt")).unwrap(),
        b"archive me"
    );
}

#[test]
fn create_archive_writes_tar_gz_file() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.tar.gz");

    fs::write(&source, b"archive me").unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::CreateArchive,
            vec![uri(&source)],
            Some(uri(&archive_path)),
        ),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    let file = File::open(&archive_path).unwrap();
    let gz = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz);
    let entries: Vec<_> = archive.entries().unwrap().collect();
    assert_eq!(entries.len(), 1);
    let entry = entries[0].as_ref().unwrap();
    assert_eq!(entry.path().unwrap().to_str().unwrap(), "source.txt");
}

#[test]
fn create_archive_writes_tar_bz2_file() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.tar.bz2");

    fs::write(&source, b"archive me").unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::CreateArchive,
            vec![uri(&source)],
            Some(uri(&archive_path)),
        ),
    )
    .unwrap();

    execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    let file = File::open(&archive_path).unwrap();
    let bz = bzip2::read::BzDecoder::new(file);
    let mut archive = tar::Archive::new(bz);
    let entries: Vec<_> = archive.entries().unwrap().collect();
    assert_eq!(entries.len(), 1);
    let entry = entries[0].as_ref().unwrap();
    assert_eq!(entry.path().unwrap().to_str().unwrap(), "source.txt");
}

#[test]
fn extract_tar_gz_archive_writes_files_to_destination() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.tar.gz");
    let extract_dir = dir.path().join("out");

    fs::write(&source, b"archive me").unwrap();

    // Create a real tar.gz using tar + flate2 directly
    let file = File::create(&archive_path).unwrap();
    let gz = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut archive = tar::Builder::new(gz);
    archive
        .append_path_with_name(&source, "source.txt")
        .unwrap();
    let gz = archive.into_inner().unwrap();
    gz.finish().unwrap();

    let extract_plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &extract_plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(extract_dir.join("source.txt")).unwrap(),
        b"archive me"
    );
}

#[test]
fn extract_tar_bz2_archive_writes_files_to_destination() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.txt");
    let archive_path = dir.path().join("archive.tar.bz2");
    let extract_dir = dir.path().join("out");

    fs::write(&source, b"archive me").unwrap();

    // Create a real tar.bz2 using tar + bzip2 directly
    let file = File::create(&archive_path).unwrap();
    let bz = bzip2::write::BzEncoder::new(file, bzip2::Compression::default());
    let mut archive = tar::Builder::new(bz);
    archive
        .append_path_with_name(&source, "source.txt")
        .unwrap();
    let bz = archive.into_inner().unwrap();
    bz.finish().unwrap();

    let extract_plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ),
    )
    .unwrap();
    execute_file_operation(
        &vfs(),
        &extract_plan,
        &JobId::new("job-extract"),
        &CancellationToken::new(),
        &PauseToken::new(),
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        fs::read(extract_dir.join("source.txt")).unwrap(),
        b"archive me"
    );
}

#[test]
fn cancellation_stops_large_copy() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("large.bin");
    let dest = dir.path().join("dest");
    let cancel = CancellationToken::new();

    fs::write(&source, vec![7_u8; (PROGRESS_BYTE_INTERVAL as usize) * 2]).unwrap();
    fs::create_dir(&dest).unwrap();

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    let token = cancel.clone();
    let result = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &cancel,
        &PauseToken::new(),
        &move |_| {
            token.cancel();
        },
    );

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

    let plan = plan_file_operation(
        &vfs(),
        request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ),
    )
    .unwrap();
    let token = cancel.clone();
    let result = execute_file_operation(
        &vfs(),
        &plan,
        &JobId::new("job"),
        &cancel,
        &PauseToken::new(),
        &move |_| {
            token.cancel();
        },
    );

    assert_eq!(result.unwrap_err().code(), "cancelled");
}
