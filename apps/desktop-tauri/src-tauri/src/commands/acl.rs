use std::sync::Arc;

#[cfg(unix)]
use std::path::Path;

use app_core::AppState;
#[cfg(unix)]
use app_ipc::AclEntry;
use app_ipc::{GetAclRequest, GetAclResponse, IpcError, SetAclRequest, SetAclResponse};
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
    _state: State<'_, Arc<AppState>>,
) -> Result<GetAclResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri)
        .map_err(|e| IpcError::invalid_request(format!("invalid URI: {e}")))?;
    let path = uri
        .to_local_path()
        .map_err(|e| IpcError::invalid_request(format!("not a local path: {e}")))?;

    let metadata =
        std::fs::symlink_metadata(&path).map_err(|e| IpcError::io(format!("cannot stat: {e}")))?;
    if metadata.file_type().is_symlink() {
        return Err(IpcError::invalid_request(
            "permissions cannot be read through a symlink",
        ));
    }

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

        Ok(GetAclResponse {
            owner: Some(uid.to_string()),
            group: Some(gid.to_string()),
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
        Err(IpcError::new(
            app_ipc::error_codes::UNSUPPORTED_OPERATION,
            "ACL inspection is unavailable on this platform",
        ))
    }
}

#[tauri::command]
pub async fn fs_set_acl(
    request: SetAclRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<SetAclResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri)
        .map_err(|e| IpcError::invalid_request(format!("invalid URI: {e}")))?;
    let path = uri
        .to_local_path()
        .map_err(|e| IpcError::invalid_request(format!("not a local path: {e}")))?;
    let metadata =
        std::fs::symlink_metadata(&path).map_err(|e| IpcError::io(format!("cannot stat: {e}")))?;
    if metadata.file_type().is_symlink() {
        return Err(IpcError::invalid_request(
            "permissions cannot be changed through a symlink",
        ));
    }

    let mode = u32::from_str_radix(&request.octal, 8)
        .map_err(|e| IpcError::invalid_request(format!("invalid octal mode: {e}")))?;

    if mode > 0o777 {
        return Err(IpcError::invalid_request(
            "octal mode must be between 000 and 777",
        ));
    }

    #[cfg(unix)]
    {
        if request.recursive && metadata.is_dir() {
            apply_recursive(&path, mode)?;
        } else {
            set_permissions_nofollow(&path, mode)?;
        }
    }

    #[cfg(not(unix))]
    {
        return Err(IpcError::new(
            app_ipc::error_codes::UNSUPPORTED_OPERATION,
            "ACL changes are unavailable on this platform",
        ));
    }

    Ok(SetAclResponse { success: true })
}

#[cfg(unix)]
fn set_permissions_nofollow(path: &Path, mode: u32) -> Result<(), IpcError> {
    use std::os::unix::fs::PermissionsExt;

    let permissions = cap_std::fs::Permissions::from_std(std::fs::Permissions::from_mode(mode));
    if let (Some(parent), Some(name)) = (path.parent(), path.file_name()) {
        let parent = parent
            .canonicalize()
            .map_err(|error| IpcError::io(format!("cannot resolve parent directory: {error}")))?;
        let directory = cap_std::fs::Dir::open_ambient_dir(parent, cap_std::ambient_authority())
            .map_err(|error| IpcError::io(format!("cannot open parent directory: {error}")))?;
        let metadata = directory
            .symlink_metadata(name)
            .map_err(|error| IpcError::io(format!("cannot inspect permissions target: {error}")))?;
        if metadata.file_type().is_symlink() {
            return Err(IpcError::invalid_request(
                "permissions cannot be changed through a symlink",
            ));
        }
        directory
            .set_permissions(name, permissions)
            .map_err(|error| IpcError::io(format!("cannot set permissions: {error}")))?;
        return Ok(());
    }

    let directory = cap_std::fs::Dir::open_ambient_dir(path, cap_std::ambient_authority())
        .map_err(|error| IpcError::io(format!("cannot open permissions target: {error}")))?;
    directory
        .set_permissions(Path::new("."), permissions)
        .map_err(|error| IpcError::io(format!("cannot set permissions: {error}")))
}

#[cfg(unix)]
fn apply_recursive(path: &Path, mode: u32) -> Result<(), IpcError> {
    use cap_fs_ext::DirExt;

    let directory = if let (Some(parent), Some(name)) = (path.parent(), path.file_name()) {
        let parent = parent
            .canonicalize()
            .map_err(|error| IpcError::io(format!("cannot resolve parent directory: {error}")))?;
        let parent = cap_std::fs::Dir::open_ambient_dir(parent, cap_std::ambient_authority())
            .map_err(|error| IpcError::io(format!("cannot open parent directory: {error}")))?;
        parent.open_dir_nofollow(name).map_err(|error| {
            IpcError::io(format!("cannot safely open permissions target: {error}"))
        })?
    } else {
        cap_std::fs::Dir::open_ambient_dir(path, cap_std::ambient_authority())
            .map_err(|error| IpcError::io(format!("cannot open permissions target: {error}")))?
    };

    apply_recursive_directory(&directory, mode)
}

#[cfg(unix)]
fn apply_recursive_directory(directory: &cap_std::fs::Dir, mode: u32) -> Result<(), IpcError> {
    use cap_fs_ext::DirExt;
    use std::os::unix::fs::PermissionsExt;

    let entries = directory
        .entries()
        .map_err(|error| IpcError::io(format!("cannot read directory: {error}")))?;

    for entry in entries {
        let entry = entry.map_err(|error| IpcError::io(format!("cannot read entry: {error}")))?;
        let name = entry.file_name();
        let metadata = directory
            .symlink_metadata(&name)
            .map_err(|error| IpcError::io(format!("cannot inspect entry: {error}")))?;

        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            let child = directory.open_dir_nofollow(&name).map_err(|error| {
                IpcError::io(format!("cannot safely open child directory: {error}"))
            })?;
            apply_recursive_directory(&child, mode)?;
        } else {
            directory
                .set_permissions(
                    &name,
                    cap_std::fs::Permissions::from_std(std::fs::Permissions::from_mode(mode)),
                )
                .map_err(|error| IpcError::io(format!("cannot set permissions: {error}")))?;
        }
    }

    directory
        .set_permissions(
            Path::new("."),
            cap_std::fs::Permissions::from_std(std::fs::Permissions::from_mode(mode)),
        )
        .map_err(|error| IpcError::io(format!("cannot set permissions: {error}")))?;

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

    #[cfg(unix)]
    #[test]
    fn recursive_permissions_skip_symlinks_and_apply_directories_post_order() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("root");
        let child = root.join("child");
        let outside = dir.path().join("outside.txt");
        std::fs::create_dir_all(&child).unwrap();
        std::fs::write(child.join("inside.txt"), b"inside").unwrap();
        std::fs::write(&outside, b"outside").unwrap();
        std::fs::set_permissions(&outside, std::fs::Permissions::from_mode(0o600)).unwrap();
        symlink(&outside, child.join("outside-link")).unwrap();

        apply_recursive(&root, 0o700).unwrap();

        assert_eq!(
            std::fs::symlink_metadata(&outside)
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert_eq!(
            std::fs::symlink_metadata(&root)
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
    }
}
