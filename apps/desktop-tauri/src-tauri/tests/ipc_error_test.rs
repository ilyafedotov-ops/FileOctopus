//! Integration tests for IPC error paths: invalid URIs, not found, permission denied.

use std::path::{Path, PathBuf};

use app_core::AppCore;
use app_ipc::IpcError;
use fs_core::sprint4;
use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-error-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn _local_uri(path: &Path) -> String {
    format!("local://{}", path.display())
}

// --- Invalid URI tests ---

#[test]
fn resource_uri_rejects_invalid_scheme() {
    let result = ResourceUri::parse("file:///tmp/test");
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    // "file://" is a recognized but unsupported provider
    assert!(err.code == "unsupported_provider" || err.code == "invalid_uri");
}

#[test]
fn resource_uri_rejects_empty_string() {
    let result = ResourceUri::parse("");
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "invalid_uri");
}

#[test]
fn resource_uri_rejects_random_text() {
    let result = ResourceUri::parse("not-a-uri-at-all");
    assert!(result.is_err());
}

#[test]
fn resource_uri_rejects_relative_path_via_from_local_path() {
    use std::path::Path;
    let result = ResourceUri::from_local_path(Path::new("relative/path"));
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "invalid_uri");
}

#[test]
fn resource_uri_parses_local_path_successfully() {
    let uri = ResourceUri::parse("local:///home/user/docs").unwrap();
    let path = uri.to_local_path().unwrap();
    assert!(path.to_string_lossy().contains("home"));
}

// --- Not found error tests ---

#[test]
fn fs_stat_nonexistent_returns_not_found() {
    let dir = temp_dir("err-stat");
    let missing = dir.join("does-not-exist.txt");
    let uri = ResourceUri::from_local_path(&missing).unwrap();

    let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let result = rt.block_on(async { state.vfs().stat(&uri).await });

    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "not_found");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn create_empty_file_in_nonexistent_dir_returns_destination_missing() {
    let dir = temp_dir("err-create");
    let nested = dir.join("no-such-dir").join("file.txt");
    let uri = ResourceUri::from_local_path(&nested).unwrap();

    let result = sprint4::create_empty_file(&uri);
    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "destination_missing");

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn delete_permanently_nonexistent_returns_error() {
    let dir = temp_dir("err-delete");
    let missing = dir.join("ghost.txt");
    let uri = ResourceUri::from_local_path(&missing).unwrap();

    let result = sprint4::delete_permanently(&[uri]);
    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

// --- Destination conflict error test ---

#[test]
fn create_empty_file_existing_returns_destination_conflict() {
    let dir = temp_dir("err-conflict");
    let file_path = dir.join("exists.txt");
    std::fs::write(&file_path, "data").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let result = sprint4::create_empty_file(&uri);

    assert!(result.is_err());
    let err: IpcError = result.unwrap_err().into();
    assert_eq!(err.code, "destination_conflict");

    let _ = std::fs::remove_dir_all(dir);
}

// --- IpcError construction tests ---

#[test]
fn ipc_error_internal_factory() {
    let err = IpcError::internal("something broke");
    assert_eq!(err.code, "internal");
    assert_eq!(err.message, "something broke");
}

#[test]
fn ipc_error_serializes_to_json() {
    let err = IpcError {
        code: "not_found".to_string(),
        message: "path does not exist".to_string(),
    };
    let json = serde_json::to_string(&err).unwrap();
    assert!(json.contains("not_found"));
    assert!(json.contains("path does not exist"));
}

#[test]
fn ipc_error_deserializes_from_json() {
    let json = r#"{"code":"permission_denied","message":"access denied"}"#;
    let err: IpcError = serde_json::from_str(json).unwrap();
    assert_eq!(err.code, "permission_denied");
    assert_eq!(err.message, "access denied");
}

// --- VfsError to IpcError conversion tests ---

#[test]
fn vfs_error_unsupported_provider_converts_to_ipc_error() {
    let result = ResourceUri::parse("ftp://invalid");
    assert!(result.is_err());
    let ipc_err: IpcError = result.unwrap_err().into();
    // ftp:// is recognized as a URI but unsupported provider
    assert_eq!(ipc_err.code, "unsupported_provider");
}
