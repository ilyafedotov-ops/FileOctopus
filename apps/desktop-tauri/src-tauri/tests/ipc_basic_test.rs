//! Integration tests for basic FS IPC handlers: stat, properties, standard locations.

use std::path::PathBuf;

use app_core::AppCore;
use app_ipc::IpcError;
use fs_core::{locations, metadata};
use vfs::{FileKind, ResourceUri};

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-basic-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn fs_stat_returns_file_metadata() {
    let dir = temp_dir("stat-file");
    let file_path = dir.join("readme.txt");
    std::fs::write(&file_path, "hello stat").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let entry = rt.block_on(async { state.vfs().stat(&uri).await }).unwrap();

    assert_eq!(entry.name, "readme.txt");
    assert_eq!(entry.kind, FileKind::File);
    assert_eq!(entry.size, Some(10));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_properties_returns_file_metadata() {
    let dir = temp_dir("props-file");
    let file_path = dir.join("notes.txt");
    std::fs::write(&file_path, "properties body").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let props = metadata::path_properties(&uri, false).unwrap();

    assert_eq!(props.name, "notes.txt");
    assert_eq!(props.kind, FileKind::File);
    assert_eq!(props.size, Some(15));
    assert!(props.modified_at.is_some());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_properties_directory_with_summary_includes_children() {
    let dir = temp_dir("props-dir");
    std::fs::write(dir.join("one.txt"), "1").unwrap();
    std::fs::write(dir.join("two.txt"), "22").unwrap();

    let uri = ResourceUri::from_local_path(&dir).unwrap();
    let props = metadata::path_properties(&uri, true).unwrap();

    assert_eq!(props.kind, FileKind::Directory);
    assert!(props.item_count.unwrap() >= 2);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_properties_missing_path_returns_not_found() {
    let dir = temp_dir("props-missing");
    let missing = dir.join("ghost.txt");
    let uri = ResourceUri::from_local_path(&missing).unwrap();

    let result = metadata::path_properties(&uri, false);
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "not_found");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_standard_locations_returns_home_entry() {
    let locations = locations::standard_locations();
    assert!(!locations.is_empty());
    assert!(locations.iter().any(|loc| loc.id == "home"));
    assert!(locations.iter().all(|loc| loc.uri.starts_with("local://")));
}

#[test]
fn fs_standard_locations_entries_have_required_fields() {
    for location in locations::standard_locations() {
        assert!(!location.id.is_empty());
        assert!(!location.name.is_empty());
        assert!(!location.section.is_empty());
        assert!(ResourceUri::parse(&location.uri).is_ok());
    }
}
