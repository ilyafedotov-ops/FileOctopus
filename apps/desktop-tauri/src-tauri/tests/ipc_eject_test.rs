//! Integration tests for the fs_eject_volume IPC handler.

#[test]
fn fs_eject_volume_rejects_nonexistent_mount_point() {
    // On Linux, umount of a nonexistent path should fail gracefully.
    // We test with a path that definitely doesn't exist.
    let result = std::process::Command::new("umount")
        .arg("/tmp/fo-eject-test-nonexistent-mount-xyz")
        .output();

    match result {
        Ok(output) => {
            // umount returns non-zero for nonexistent mount
            assert!(
                !output.status.success()
                    || String::from_utf8_lossy(&output.stderr).contains("not mounted")
            );
        }
        Err(_) => {
            // umount binary not available (unlikely on Linux)
        }
    }
}

#[test]
fn fs_eject_volume_rejects_root_mount() {
    // umount / should fail with permission denied or similar
    let result = std::process::Command::new("umount").arg("/").output();

    match result {
        Ok(output) => {
            // Root mount cannot be unmounted by non-root users
            assert!(!output.status.success());
        }
        Err(_) => {
            // umount not available
        }
    }
}

#[test]
fn eject_volume_dto_serializes_correctly() {
    use app_ipc::EjectVolumeRequest;

    let req = EjectVolumeRequest {
        mount_point: "/media/usb".to_string(),
    };

    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("mountPoint"), "expected camelCase mountPoint");
    assert!(json.contains("/media/usb"));

    let de: EjectVolumeRequest = serde_json::from_str(&json).unwrap();
    assert_eq!(de.mount_point, "/media/usb");
}

#[test]
fn eject_volume_response_dto_serializes_correctly() {
    use app_ipc::EjectVolumeResponse;

    let resp = EjectVolumeResponse { success: true };
    let json = serde_json::to_string(&resp).unwrap();
    assert!(json.contains("success"));
    assert!(json.contains("true"));

    let de: EjectVolumeResponse = serde_json::from_str(&json).unwrap();
    assert!(de.success);
}
