use provider_smb::ops::join_remote_path;
use provider_smb::ops::map_smb_error;
use vfs::{ResourceUri, VfsError};

const PROFILE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

#[test]
fn join_path_appends_without_extra_slash() {
    assert_eq!(join_remote_path("/home", "user"), "/home/user");
}

#[test]
fn join_path_handles_trailing_slash() {
    assert_eq!(join_remote_path("/home/", "user"), "/home/user");
}

#[test]
fn join_path_root() {
    assert_eq!(join_remote_path("/", "share"), "/share");
}

#[test]
fn smb_error_not_found() {
    let uri = ResourceUri::from_remote_profile("smb", PROFILE_ID, "/missing.txt").unwrap();
    let err = map_smb_error(&uri, "NT_STATUS_OBJECT_NAME_NOT_FOUND");
    assert_eq!(err.code(), "not_found");
}

#[test]
fn smb_error_permission_denied() {
    let uri = ResourceUri::from_remote_profile("smb", PROFILE_ID, "/secret").unwrap();
    let err = map_smb_error(&uri, "NT_STATUS_ACCESS_DENIED");
    assert_eq!(err.code(), "permission_denied");
}

#[test]
fn smb_error_generic() {
    let uri = ResourceUri::from_remote_profile("smb", PROFILE_ID, "/file").unwrap();
    let err = map_smb_error(&uri, "something unexpected happened");
    match err {
        VfsError::Internal { message } => {
            assert!(message.contains("something unexpected happened"));
        }
        other => panic!("expected Internal, got {:?}", other),
    }
}
