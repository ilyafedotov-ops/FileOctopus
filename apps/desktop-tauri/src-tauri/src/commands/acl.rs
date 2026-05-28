use std::path::PathBuf;

use app_core::AppState;
use app_ipc::{AclEntry, GetAclRequest, GetAclResponse, IpcError, SetAclRequest, SetAclResponse};
use tauri::State;
use vfs::ResourceUri;

fn parse_rwx(triplet: u32) -> (bool, bool, bool) {
    let r = (triplet & 0o4) != 0;
    let w = (triplet & 0o2) != 0;
    let x = (triplet & 0o1) != 0;
    (r, w, x)
}

fn mode_to_octal(mode: u32) -> String {
    format!("{:o}", mode & 0o777)
}

#[tauri::command]
pub async fn fs_get_acl(
    request: GetAclRequest,
    _state: State<'_, AppState>,
) -> Result<GetAclResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri)
        .map_err(|e| IpcError::invalid_request(format!("invalid URI: {e}")))?;
    let path = uri
        .to_local_path()
        .map_err(|e| IpcError::invalid_request(format!("not a local path: {e}")))?;

    let metadata =
        std::fs::metadata(&path).map_err(|e| IpcError::io(format!("cannot stat: {e}")))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        let mode = metadata.permissions().mode();
        let octal = mode_to_octal(mode);

        let (ur, uw, ux) = parse_rwx((mode >> 6) & 0o7);
        let (gr, gw, gx) = parse_rwx((mode >> 3) & 0o7);
        let (or, ow, ox) = parse_rwx(mode & 0o7);

        let uid = metadata.uid();
        let gid = metadata.gid();

        let owner_name = std::process::Command::new("id")
            .args(["-nu", &uid.to_string()])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string());

        let group_name = std::process::Command::new("getent")
            .args(["group", &gid.to_string()])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| {
                let parts: Vec<&str> = s.trim().split(':').collect();
                parts.first().map(|p| p.to_string()).unwrap_or_default()
            });

        Ok(GetAclResponse {
            owner: owner_name,
            group: group_name,
            entries: vec![
                AclEntry {
                    principal: "owner".to_string(),
                    read: ur,
                    write: uw,
                    execute: ux,
                },
                AclEntry {
                    principal: "group".to_string(),
                    read: gr,
                    write: gw,
                    execute: gx,
                },
                AclEntry {
                    principal: "other".to_string(),
                    read: or,
                    write: ow,
                    execute: ox,
                },
            ],
            octal,
        })
    }

    #[cfg(not(unix))]
    {
        Ok(GetAclResponse {
            owner: None,
            group: None,
            entries: vec![AclEntry {
                principal: "owner".to_string(),
                read: metadata.permissions().readonly(),
                write: !metadata.permissions().readonly(),
                execute: false,
            }],
            octal: "000".to_string(),
        })
    }
}

#[tauri::command]
pub async fn fs_set_acl(
    request: SetAclRequest,
    _state: State<'_, AppState>,
) -> Result<SetAclResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri)
        .map_err(|e| IpcError::invalid_request(format!("invalid URI: {e}")))?;
    let path = uri
        .to_local_path()
        .map_err(|e| IpcError::invalid_request(format!("not a local path: {e}")))?;

    let mode = u32::from_str_radix(&request.octal, 8)
        .map_err(|e| IpcError::invalid_request(format!("invalid octal mode: {e}")))?;

    if mode > 0o777 {
        return Err(IpcError::invalid_request(
            "octal mode must be between 000 and 777",
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode))
            .map_err(|e| IpcError::io(format!("cannot set permissions: {e}")))?;

        if request.recursive && path.is_dir() {
            apply_recursive(&path, mode)?;
        }
    }

    Ok(SetAclResponse { success: true })
}

#[cfg(unix)]
fn apply_recursive(path: &PathBuf, mode: u32) -> Result<(), IpcError> {
    use std::os::unix::fs::PermissionsExt;

    let entries =
        std::fs::read_dir(path).map_err(|e| IpcError::io(format!("cannot read directory: {e}")))?;

    for entry in entries {
        let entry = entry.map_err(|e| IpcError::io(format!("cannot read entry: {e}")))?;
        let entry_path = entry.path();

        std::fs::set_permissions(&entry_path, std::fs::Permissions::from_mode(mode))
            .map_err(|e| IpcError::io(format!("cannot set permissions: {e}")))?;

        if entry_path.is_dir() {
            apply_recursive(&entry_path, mode)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_rwx_all_bits() {
        let (r, w, x) = parse_rwx(0o7);
        assert!(r);
        assert!(w);
        assert!(x);
    }

    #[test]
    fn parse_rwx_read_only() {
        let (r, w, x) = parse_rwx(0o4);
        assert!(r);
        assert!(!w);
        assert!(!x);
    }

    #[test]
    fn parse_rwx_write_only() {
        let (r, w, x) = parse_rwx(0o2);
        assert!(!r);
        assert!(w);
        assert!(!x);
    }

    #[test]
    fn parse_rwx_execute_only() {
        let (r, w, x) = parse_rwx(0o1);
        assert!(!r);
        assert!(!w);
        assert!(x);
    }

    #[test]
    fn parse_rwx_none() {
        let (r, w, x) = parse_rwx(0o0);
        assert!(!r);
        assert!(!w);
        assert!(!x);
    }

    #[test]
    fn mode_to_octal_common_modes() {
        assert_eq!(mode_to_octal(0o755), "755");
        assert_eq!(mode_to_octal(0o644), "644");
        assert_eq!(mode_to_octal(0o777), "777");
        assert_eq!(mode_to_octal(0o600), "600");
    }
}
