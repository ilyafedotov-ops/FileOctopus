use provider_sftp::capabilities_from_perm;
use vfs::FileKind;

#[test]
fn writable_file_when_user_has_write_bit() {
    let caps = capabilities_from_perm(Some(0o100644), FileKind::File);
    assert!(caps.can_write);
    assert!(caps.can_delete);
    assert!(caps.can_rename);
}

#[test]
fn read_only_when_user_lacks_write_bit() {
    let caps = capabilities_from_perm(Some(0o100444), FileKind::File);
    assert!(!caps.can_write);
    assert!(!caps.can_delete);
    assert!(!caps.can_rename);
}
