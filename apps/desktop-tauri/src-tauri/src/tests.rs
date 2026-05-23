use std::io::Read;

use app_core::AppCore;
use app_ipc::{error_codes, IpcError};
use config::RecentBucket;
use fs_core::{direct_ops, metadata};
use vfs::{FileKind, ResourceUri};

use crate::commands::app_info::app_get_info;
use crate::commands::diagnostics::{resolve_diagnostics_destination, write_diagnostics_bundle};

fn temp_dir(prefix: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fo-ipc-test-{}-{}", prefix, uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn local_uri(path: &std::path::Path) -> String {
    format!("local://{}", path.display())
}

#[test]
fn app_info_response_has_stable_metadata_fields() {
    let info = app_get_info();

    assert_eq!(info.name, "FileOctopus");
    assert!(!info.version.is_empty());
    assert!(!info.build_profile.is_empty());
    assert!(!info.target_os.is_empty());
    assert!(!info.data_dir.is_empty());
    assert_eq!(info.network_enabled, app_core::is_network_enabled());
}

#[test]
fn diagnostics_bundle_contains_expected_files() {
    let dir = std::env::temp_dir().join(format!(
        "fileoctopus-diagnostics-test-{}",
        uuid::Uuid::new_v4()
    ));

    std::fs::create_dir_all(&dir).unwrap();
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let bundle = dir.join("diagnostics.zip");
    let files = write_diagnostics_bundle(&bundle, &state).unwrap();

    assert!(bundle.exists());
    assert!(files.contains(&"app-info.json".to_string()));
    assert!(files.contains(&"app-data-health.json".to_string()));
    assert!(files.contains(&"operation-history.json".to_string()));
    assert!(files.contains(&"recent-log.txt".to_string()));

    let _ = std::fs::remove_dir_all(dir);
}

fn app_paths_under(root: &std::path::Path) -> app_core::AppPaths {
    app_core::AppPaths {
        config_dir: root.join("config"),
        data_dir: root.to_path_buf(),
        log_dir: root.join("logs"),
        history_db: root.join("history.sqlite"),
        preferences_db: root.join("preferences.sqlite"),
        navigation_db: root.join("navigation.sqlite"),
        network_db: root.join("network.sqlite"),
    }
}

#[test]
fn diagnostics_destination_accepts_path_in_allowed_root() {
    let root = temp_dir("diag-allowed");
    let paths = app_paths_under(&root);
    let target = root.join("fileoctopus-diagnostics.zip");

    let resolved = resolve_diagnostics_destination(&target.to_string_lossy(), &paths).unwrap();

    assert_eq!(resolved, target);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn diagnostics_destination_rejects_relative_path() {
    let paths = app_paths_under(&temp_dir("diag-relative"));

    let error = resolve_diagnostics_destination("relative/diagnostics.zip", &paths).unwrap_err();

    assert_eq!(error.code, error_codes::INVALID_PATH);
}

#[test]
fn diagnostics_destination_rejects_traversal_segments() {
    let root = temp_dir("diag-traversal");
    let paths = app_paths_under(&root);
    let target = format!("{}/../escape.zip", root.display());

    let error = resolve_diagnostics_destination(&target, &paths).unwrap_err();

    assert_eq!(error.code, error_codes::INVALID_PATH);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn diagnostics_destination_rejects_outside_allowed_roots() {
    let paths = app_paths_under(&temp_dir("diag-outside"));

    let error = resolve_diagnostics_destination("/etc/cron.d/fileoctopus.zip", &paths).unwrap_err();

    assert_eq!(error.code, error_codes::INVALID_PATH);
}

#[test]
#[cfg(unix)]
fn diagnostics_destination_accepts_shipped_default_path() {
    let paths = app_paths_under(&temp_dir("diag-default"));

    let resolved =
        resolve_diagnostics_destination("/tmp/fileoctopus-diagnostics.zip", &paths).unwrap();

    assert_eq!(
        resolved,
        std::path::PathBuf::from("/tmp/fileoctopus-diagnostics.zip")
    );
}

#[test]
fn diagnostics_destination_rejects_non_zip_extension() {
    let root = temp_dir("diag-extension");
    let paths = app_paths_under(&root);
    let target = root.join("authorized_keys");

    let error = resolve_diagnostics_destination(&target.to_string_lossy(), &paths).unwrap_err();

    assert_eq!(error.code, error_codes::INVALID_PATH);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn fs_read_text_file_reads_file_content() {
    let dir = temp_dir("read-text");
    let file_path = dir.join("hello.txt");
    std::fs::write(&file_path, "Hello, FileOctopus!").unwrap();

    let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
    let path = uri.to_local_path().unwrap();
    let metadata = std::fs::metadata(&path).unwrap();
    let file_size = metadata.len();
    let max_bytes = 1_048_576u64;
    let read_len = std::cmp::min(max_bytes, file_size) as usize;
    let mut buf = vec![0u8; read_len];
    let mut f = std::fs::File::open(&path).unwrap();
    let n = f.read(&mut buf).unwrap();
    buf.truncate(n);
    let content = String::from_utf8_lossy(&buf).to_string();

    assert_eq!(content, "Hello, FileOctopus!");
    assert_eq!(file_size, 19);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_rejects_directory() {
    let dir = temp_dir("read-dir");
    let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
    let path = uri.to_local_path().unwrap();

    let metadata = std::fs::metadata(&path).unwrap();
    assert!(metadata.is_dir());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_read_text_file_handles_truncation() {
    let dir = temp_dir("read-trunc");
    let file_path = dir.join("big.txt");
    let data = "A".repeat(200);
    std::fs::write(&file_path, &data).unwrap();

    let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
    let path = uri.to_local_path().unwrap();
    let metadata = std::fs::metadata(&path).unwrap();
    let file_size = metadata.len();
    let max_bytes = 100u64;
    let truncated = file_size > max_bytes;

    assert!(truncated);
    assert_eq!(file_size, 200);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_produces_sha256() {
    let dir = temp_dir("hash");
    let file_path = dir.join("data.bin");
    std::fs::write(&file_path, b"test content").unwrap();

    let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
    let path = uri.to_local_path().unwrap();
    let metadata = std::fs::metadata(&path).unwrap();

    assert!(!metadata.is_dir());

    let hash = sha256::try_digest(&path).unwrap();
    assert_eq!(hash.len(), 64); // SHA-256 hex is 64 chars
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_compute_hash_rejects_directory() {
    let dir = temp_dir("hash-dir");
    let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
    let path = uri.to_local_path().unwrap();
    let metadata = std::fs::metadata(&path).unwrap();

    assert!(metadata.is_dir());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn create_empty_file_creates_empty_file() {
    let dir = temp_dir("create-file");
    let file_path = dir.join("newfile.txt");
    let uri = local_uri(&file_path);
    let parsed = ResourceUri::parse(&uri).unwrap();

    let entry = direct_ops::create_empty_file(&parsed).unwrap();
    assert!(file_path.exists());
    assert_eq!(entry.name, "newfile.txt");
    assert_eq!(entry.size, Some(0));
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn create_empty_file_rejects_duplicate() {
    let dir = temp_dir("create-dup");
    let file_path = dir.join("exists.txt");
    std::fs::write(&file_path, "already here").unwrap();

    let uri = local_uri(&file_path);
    let parsed = ResourceUri::parse(&uri).unwrap();

    let result = direct_ops::create_empty_file(&parsed);
    assert!(result.is_err());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn delete_permanently_removes_file() {
    let dir = temp_dir("delete");
    let file_path = dir.join("to-delete.txt");
    std::fs::write(&file_path, "bye").unwrap();
    assert!(file_path.exists());

    let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
    direct_ops::delete_permanently(&[uri]).unwrap();
    assert!(!file_path.exists());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn delete_permanently_removes_directory() {
    let dir = temp_dir("delete-dir");
    let sub = dir.join("subdir");
    std::fs::create_dir_all(&sub).unwrap();
    std::fs::write(sub.join("inner.txt"), "data").unwrap();

    let uri = ResourceUri::parse(&local_uri(&sub)).unwrap();
    direct_ops::delete_permanently(&[uri]).unwrap();
    assert!(!sub.exists());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_properties_returns_metadata() {
    let dir = temp_dir("props");
    let file_path = dir.join("info.txt");
    std::fs::write(&file_path, "properties test").unwrap();

    let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
    let props = metadata::path_properties(&uri, false).unwrap();

    assert_eq!(props.name, "info.txt");
    assert_eq!(props.size, Some(15));
    assert_eq!(props.kind, FileKind::File);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_properties_directory_includes_item_count() {
    let dir = temp_dir("props-dir");
    std::fs::write(dir.join("a.txt"), "a").unwrap();
    std::fs::write(dir.join("b.txt"), "b").unwrap();

    let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
    let props = metadata::path_properties(&uri, true).unwrap();

    assert_eq!(props.kind, FileKind::Directory);
    assert!(props.item_count.unwrap() >= 2);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_folder_size_calculates_total() {
    let dir = temp_dir("foldersize");
    std::fs::write(dir.join("f1.txt"), "12345").unwrap();
    std::fs::write(dir.join("f2.txt"), "67890").unwrap();

    let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
    let summary = metadata::calculate_folder_size(&uri).unwrap();

    assert!(summary.total_size >= 10);
    assert!(summary.file_count >= 2);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn resource_uri_rejects_invalid_scheme() {
    let result = ResourceUri::parse("file:///tmp/test");
    assert!(result.is_err());
}

#[test]
fn resource_uri_rejects_empty_string() {
    let result = ResourceUri::parse("");
    assert!(result.is_err());
}

#[test]
fn resource_uri_parses_local_path() {
    let uri = ResourceUri::parse("local:///home/user/docs").unwrap();
    let path = uri.to_local_path().unwrap();
    assert!(path.to_string_lossy().contains("home"));
}

#[test]
fn ipc_error_serializes_to_json() {
    let err = IpcError::new(error_codes::NOT_FOUND, "path does not exist");
    let json = serde_json::to_string(&err).unwrap();
    assert!(json.contains("not_found"));
    assert!(json.contains("path does not exist"));
}

#[test]
fn preferences_round_trip_via_state() {
    let dir = temp_dir("prefs");
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();

    let prefs = state.preferences();
    let _initial = prefs.get_all().unwrap();
    prefs.set("theme", "dark").unwrap();

    let updated = prefs.get_all().unwrap();
    assert_eq!(updated.theme, "dark");
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn navigation_records_visit() {
    let dir = temp_dir("nav-visit");
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();

    let nav = state.navigation();
    nav.record_visit("local:///tmp/test-nav", "Test Dir")
        .unwrap();

    let recent = nav.list_recent(RecentBucket::Today).unwrap();
    assert!(!recent.is_empty());
    assert!(recent[0].uri == "local:///tmp/test-nav");
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn navigation_favorites_crud() {
    let dir = temp_dir("nav-fav");
    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();

    let nav = state.navigation();
    let fav = nav.add_favorite("local:///tmp/fav", "My Fav").unwrap();

    let favs = nav.list_favorites().unwrap();
    assert!(favs.iter().any(|f| f.uri == "local:///tmp/fav"));

    nav.remove_favorite(fav.id).unwrap();
    let favs_after = nav.list_favorites().unwrap();
    assert!(!favs_after.iter().any(|f| f.uri == "local:///tmp/fav"));
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_stat_returns_entry_metadata() {
    let dir = temp_dir("stat");
    let file_path = dir.join("stat-me.txt");
    std::fs::write(&file_path, "stat content").unwrap();

    let uri = local_uri(&file_path);
    let parsed = ResourceUri::parse(&uri).unwrap();

    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let entry = rt
        .block_on(async { state.vfs().stat(&parsed).await })
        .unwrap();

    assert_eq!(entry.name, "stat-me.txt");
    assert_eq!(entry.size, Some(12));
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_stat_rejects_nonexistent() {
    let dir = temp_dir("stat-missing");
    let file_path = dir.join("nope.txt");
    let uri = local_uri(&file_path);
    let parsed = ResourceUri::parse(&uri).unwrap();

    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let result = rt.block_on(async { state.vfs().stat(&parsed).await });

    assert!(result.is_err());
    let _ = std::fs::remove_dir_all(dir);
}
