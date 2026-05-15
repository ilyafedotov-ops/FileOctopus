use std::fs;

use fs_core::sprint4::{
    calculate_folder_size, calculate_folder_size_with_progress, create_empty_file,
    open_path_with_default_app, path_properties, recursive_search, recursive_search_with_progress,
    reveal_path_in_file_manager, standard_locations,
};
use jobs::CancellationToken;
use tempfile::tempdir;
use vfs::{FileKind, ResourceUri};

fn uri(path: &std::path::Path) -> ResourceUri {
    ResourceUri::from_local_path(path).unwrap()
}

#[test]
fn create_empty_file_rejects_collision_and_invalid_name() {
    let dir = tempdir().unwrap();
    let file = dir.path().join("alpha.txt");
    fs::write(&file, b"existing").unwrap();

    let collision = create_empty_file(&uri(&file)).unwrap_err();
    assert_eq!(collision.code(), "destination_conflict");

    let invalid = ResourceUri::from_local_path(&dir.path().join("bad/name.txt")).unwrap();
    let invalid_error = create_empty_file(&invalid).unwrap_err();
    assert_eq!(invalid_error.code(), "destination_missing");
}

#[test]
fn create_empty_file_writes_zero_byte_file() {
    let dir = tempdir().unwrap();
    let file = dir.path().join("new.txt");

    let entry = create_empty_file(&uri(&file)).unwrap();

    assert_eq!(entry.kind, FileKind::File);
    assert_eq!(entry.size, Some(0));
    assert_eq!(fs::read(&file).unwrap(), b"");
}

#[test]
fn properties_include_core_metadata_and_folder_summary() {
    let dir = tempdir().unwrap();
    let folder = dir.path().join("folder");
    fs::create_dir(&folder).unwrap();
    fs::write(folder.join("one.txt"), b"1234").unwrap();
    fs::write(folder.join(".hidden"), b"xx").unwrap();

    let properties = path_properties(&uri(&folder), true).unwrap();

    assert_eq!(properties.kind, FileKind::Directory);
    assert_eq!(properties.name, "folder");
    assert_eq!(properties.item_count, Some(2));
    assert_eq!(properties.total_size, Some(6));
}

#[test]
fn folder_size_handles_nested_files_without_following_symlink_cycles() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("a").join("b");
    fs::create_dir_all(&nested).unwrap();
    fs::write(nested.join("file.txt"), b"hello").unwrap();

    #[cfg(unix)]
    std::os::unix::fs::symlink(dir.path().join("a"), nested.join("loop")).unwrap();

    let summary = calculate_folder_size(&uri(dir.path())).unwrap();

    assert_eq!(summary.file_count, 1);
    assert_eq!(summary.total_size, 5);
    assert!(!summary.incomplete);
}

#[test]
fn recursive_search_matches_names_and_summarizes_permission_like_errors() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path().join("src")).unwrap();
    fs::write(dir.path().join("src").join("needle.txt"), b"").unwrap();
    fs::write(dir.path().join("src").join("other.log"), b"").unwrap();

    let results = recursive_search(&uri(dir.path()), "needle", 50).unwrap();

    assert_eq!(results.matches.len(), 1);
    assert_eq!(results.matches[0].name, "needle.txt");
    assert!(!results.incomplete);
}

#[test]
fn folder_size_can_be_cancelled_during_traversal() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("one.txt"), b"one").unwrap();
    fs::write(dir.path().join("two.txt"), b"two").unwrap();
    let cancel = CancellationToken::new();
    let token = cancel.clone();

    let error = calculate_folder_size_with_progress(&uri(dir.path()), &cancel, move |_, _| {
        token.cancel();
    })
    .unwrap_err();

    assert_eq!(error.code(), "cancelled");
}

#[test]
fn recursive_search_can_be_cancelled_after_incremental_result() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("needle-one.txt"), b"").unwrap();
    fs::write(dir.path().join("needle-two.txt"), b"").unwrap();
    let cancel = CancellationToken::new();
    let token = cancel.clone();
    let mut streamed = 0;

    let error = recursive_search_with_progress(&uri(dir.path()), "needle", 50, &cancel, |_, _| {
        streamed += 1;
        token.cancel();
    })
    .unwrap_err();

    assert_eq!(error.code(), "cancelled");
    assert_eq!(streamed, 1);
}

#[test]
fn standard_locations_include_home_and_existing_targets_only() {
    let locations = standard_locations();

    assert!(locations.iter().any(|location| location.id == "home"));
    assert!(locations.iter().all(|location| {
        ResourceUri::parse(&location.uri)
            .ok()
            .and_then(|uri| uri.to_local_path().ok())
            .is_some_and(|path| path.exists())
    }));
}

#[test]
fn standard_locations_tag_sections_consistently() {
    let locations = standard_locations();

    let home = locations
        .iter()
        .find(|location| location.id == "home")
        .expect("home location is required");
    assert_eq!(home.section, "Favorites");

    for location in locations.iter().filter(|location| {
        matches!(
            location.id.as_str(),
            "desktop" | "documents" | "downloads" | "pictures" | "music" | "videos"
        )
    }) {
        assert_eq!(location.section, "User folders");
    }

    assert!(
        !locations
            .iter()
            .any(|location| location.uri.to_ascii_lowercase().contains("timemachine")),
        "TimeMachine snapshot volumes should be filtered from sidebar"
    );
}

#[cfg(unix)]
#[test]
fn standard_locations_include_unix_root_volume() {
    let locations = standard_locations();

    let root = locations
        .iter()
        .find(|location| location.uri == "local:///")
        .expect("unix root volume should appear in sidebar");
    assert_eq!(root.section, "Devices/Volumes");

    #[cfg(target_os = "macos")]
    if std::path::Path::new("/Volumes/Macintosh HD").exists() {
        assert_eq!(root.name, "Macintosh HD");
        assert_eq!(root.id, "macintosh-hd");
    }
}

#[test]
fn open_and_reveal_reject_missing_paths_before_launching_os_commands() {
    let dir = tempdir().unwrap();
    let missing = uri(&dir.path().join("missing.txt"));

    assert_eq!(
        open_path_with_default_app(&missing).unwrap_err().code(),
        "not_found"
    );
    assert_eq!(
        reveal_path_in_file_manager(&missing).unwrap_err().code(),
        "not_found"
    );
}
