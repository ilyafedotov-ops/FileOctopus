//! Integration tests for fs_get_acl / fs_set_acl command logic.

use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

use vfs::ResourceUri;

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fo-ipc-acl-test-{}-{}",
        prefix,
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Simulates fs_get_acl handler logic: parse URI → stat → extract mode → build response.
#[allow(clippy::type_complexity)]
fn get_acl_logic(uri_str: &str) -> Result<(String, Vec<(String, bool, bool, bool)>), String> {
    let uri = ResourceUri::parse(uri_str).map_err(|e| format!("invalid URI: {e}"))?;
    let path = uri
        .to_local_path()
        .map_err(|e| format!("not a local path: {e}"))?;

    let metadata = std::fs::metadata(&path).map_err(|e| format!("cannot stat: {e}"))?;
    let mode = metadata.permissions().mode();
    let octal = format!("{:o}", mode & 0o777);

    fn parse_rwx(triplet: u32) -> (bool, bool, bool) {
        (
            (triplet & 0o4) != 0,
            (triplet & 0o2) != 0,
            (triplet & 0o1) != 0,
        )
    }

    let (ur, uw, ux) = parse_rwx((mode >> 6) & 0o7);
    let (gr, gw, gx) = parse_rwx((mode >> 3) & 0o7);
    let (or, ow, ox) = parse_rwx(mode & 0o7);

    let entries = vec![
        ("owner".to_string(), ur, uw, ux),
        ("group".to_string(), gr, gw, gx),
        ("other".to_string(), or, ow, ox),
    ];

    Ok((octal, entries))
}

/// Simulates fs_set_acl handler logic: parse URI → parse octal → set permissions.
fn set_acl_logic(uri_str: &str, octal: &str, recursive: bool) -> Result<(), String> {
    let uri = ResourceUri::parse(uri_str).map_err(|e| format!("invalid URI: {e}"))?;
    let path = uri
        .to_local_path()
        .map_err(|e| format!("not a local path: {e}"))?;

    let mode = u32::from_str_radix(octal, 8).map_err(|e| format!("invalid octal mode: {e}"))?;

    if mode > 0o777 {
        return Err("octal mode must be between 000 and 777".to_string());
    }

    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode))
        .map_err(|e| format!("cannot set permissions: {e}"))?;

    if recursive && path.is_dir() {
        apply_recursive(&path, mode)?;
    }

    Ok(())
}

fn apply_recursive(path: &PathBuf, mode: u32) -> Result<(), String> {
    let entries = std::fs::read_dir(path).map_err(|e| format!("cannot read directory: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("cannot read entry: {e}"))?;
        let entry_path = entry.path();

        std::fs::set_permissions(&entry_path, std::fs::Permissions::from_mode(mode))
            .map_err(|e| format!("cannot set permissions: {e}"))?;

        if entry_path.is_dir() {
            apply_recursive(&entry_path, mode)?;
        }
    }

    Ok(())
}

#[test]
fn fs_get_acl_returns_permissions_for_file() {
    let dir = temp_dir("get-file");
    let file_path = dir.join("test.txt");
    std::fs::write(&file_path, "hello acl").unwrap();

    // Set known permissions
    std::fs::set_permissions(&file_path, std::fs::Permissions::from_mode(0o644)).unwrap();

    let uri = format!("local://{}", file_path.display());
    let (octal, entries) = get_acl_logic(&uri).unwrap();

    assert_eq!(octal, "644");
    assert_eq!(entries.len(), 3);

    // Owner: rw-
    assert_eq!(entries[0].0, "owner");
    assert!(entries[0].1); // read
    assert!(entries[0].2); // write
    assert!(!entries[0].3); // execute

    // Group: r--
    assert_eq!(entries[1].0, "group");
    assert!(entries[1].1); // read
    assert!(!entries[1].2); // write
    assert!(!entries[1].3); // execute

    // Other: r--
    assert_eq!(entries[2].0, "other");
    assert!(entries[2].1); // read
    assert!(!entries[2].2); // write
    assert!(!entries[2].3); // execute

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_get_acl_returns_permissions_for_directory() {
    let dir = temp_dir("get-dir");
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();

    let uri = format!("local://{}", dir.display());
    let (octal, entries) = get_acl_logic(&uri).unwrap();

    assert_eq!(octal, "755");

    // Owner: rwx
    assert!(entries[0].1 && entries[0].2 && entries[0].3);
    // Group: r-x
    assert!(entries[1].1 && !entries[1].2 && entries[1].3);
    // Other: r-x
    assert!(entries[2].1 && !entries[2].2 && entries[2].3);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_get_acl_full_permissions_777() {
    let dir = temp_dir("get-777");
    let file_path = dir.join("all.txt");
    std::fs::write(&file_path, "full perms").unwrap();
    std::fs::set_permissions(&file_path, std::fs::Permissions::from_mode(0o777)).unwrap();

    let uri = format!("local://{}", file_path.display());
    let (octal, entries) = get_acl_logic(&uri).unwrap();

    assert_eq!(octal, "777");
    for entry in &entries {
        assert!(entry.1 && entry.2 && entry.3);
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_get_acl_no_permissions_000() {
    let dir = temp_dir("get-000");
    let file_path = dir.join("none.txt");
    std::fs::write(&file_path, "no perms").unwrap();
    std::fs::set_permissions(&file_path, std::fs::Permissions::from_mode(0o000)).unwrap();

    let uri = format!("local://{}", file_path.display());
    let (octal, entries) = get_acl_logic(&uri).unwrap();

    assert_eq!(octal, "0");
    for entry in &entries {
        assert!(!entry.1 && !entry.2 && !entry.3);
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_get_acl_missing_file_returns_error() {
    let dir = temp_dir("get-missing");
    let missing = dir.join("ghost.txt");
    let uri = format!("local://{}", missing.display());

    let result = get_acl_logic(&uri);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("cannot stat"));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_set_acl_changes_file_permissions() {
    let dir = temp_dir("set-file");
    let file_path = dir.join("writable.txt");
    std::fs::write(&file_path, "change me").unwrap();

    // Start with 644
    std::fs::set_permissions(&file_path, std::fs::Permissions::from_mode(0o644)).unwrap();

    let uri = format!("local://{}", file_path.display());
    set_acl_logic(&uri, "755", false).unwrap();

    // Verify the change
    let metadata = std::fs::metadata(&file_path).unwrap();
    let mode = metadata.permissions().mode() & 0o777;
    assert_eq!(mode, 0o755);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_set_acl_changes_directory_permissions() {
    let dir = temp_dir("set-dir");
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();

    let uri = format!("local://{}", dir.display());
    set_acl_logic(&uri, "700", false).unwrap();

    let metadata = std::fs::metadata(&dir).unwrap();
    let mode = metadata.permissions().mode() & 0o777;
    assert_eq!(mode, 0o700);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_set_acl_recursive_applies_to_children() {
    let dir = temp_dir("set-recursive");
    let subdir = dir.join("sub");
    std::fs::create_dir_all(&subdir).unwrap();
    let file1 = dir.join("a.txt");
    let file2 = subdir.join("b.txt");
    std::fs::write(&file1, "a").unwrap();
    std::fs::write(&file2, "b").unwrap();

    // Set different initial permissions
    std::fs::set_permissions(&file1, std::fs::Permissions::from_mode(0o644)).unwrap();
    std::fs::set_permissions(&file2, std::fs::Permissions::from_mode(0o600)).unwrap();
    std::fs::set_permissions(&subdir, std::fs::Permissions::from_mode(0o755)).unwrap();

    let uri = format!("local://{}", dir.display());
    set_acl_logic(&uri, "700", true).unwrap();

    // All entries should now be 700
    let mode1 = std::fs::metadata(&file1).unwrap().permissions().mode() & 0o777;
    let mode2 = std::fs::metadata(&file2).unwrap().permissions().mode() & 0o777;
    let mode_sub = std::fs::metadata(&subdir).unwrap().permissions().mode() & 0o777;

    assert_eq!(mode1, 0o700);
    assert_eq!(mode2, 0o700);
    assert_eq!(mode_sub, 0o700);

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_set_acl_rejects_invalid_octal() {
    let dir = temp_dir("set-invalid");
    let file_path = dir.join("test.txt");
    std::fs::write(&file_path, "data").unwrap();

    let uri = format!("local://{}", file_path.display());

    // Non-octal characters
    let result = set_acl_logic(&uri, "abc", false);
    assert!(result.is_err());

    // Octal > 777
    let result = set_acl_logic(&uri, "1000", false);
    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_set_acl_rejects_missing_file() {
    let dir = temp_dir("set-missing");
    let missing = dir.join("ghost.txt");
    let uri = format!("local://{}", missing.display());

    let result = set_acl_logic(&uri, "644", false);
    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn fs_set_acl_non_recursive_does_not_affect_children() {
    let dir = temp_dir("set-nonrecursive");
    let file1 = dir.join("child.txt");
    std::fs::write(&file1, "untouched").unwrap();

    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();
    std::fs::set_permissions(&file1, std::fs::Permissions::from_mode(0o644)).unwrap();

    let uri = format!("local://{}", dir.display());
    set_acl_logic(&uri, "700", false).unwrap();

    // Directory changed
    let dir_mode = std::fs::metadata(&dir).unwrap().permissions().mode() & 0o777;
    assert_eq!(dir_mode, 0o700);

    // Child NOT changed
    let file_mode = std::fs::metadata(&file1).unwrap().permissions().mode() & 0o777;
    assert_eq!(file_mode, 0o644);

    let _ = std::fs::remove_dir_all(dir);
}
