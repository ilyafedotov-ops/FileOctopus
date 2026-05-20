use fs_core::vfs_io::VfsFilesystem;
use std::io::Write;
use tempfile::NamedTempFile;
use vfs::ResourceUri;

#[test]
fn read_file_range_returns_paged_bytes_and_total_size() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(b"abcdefghijklmnop").unwrap();
    let path = file.path().to_path_buf();
    let uri = ResourceUri::from_local_path(&path).unwrap();

    let vfs = VfsFilesystem::local_only();

    let (bytes, total) = vfs.read_file_range(&uri, 4, 8).unwrap();
    assert_eq!(bytes, b"efghijkl");
    assert_eq!(total, 16);

    let (tail, total_again) = vfs.read_file_range(&uri, 12, 100).unwrap();
    assert_eq!(tail, b"mnop");
    assert_eq!(total_again, 16);

    let (empty, total_eof) = vfs.read_file_range(&uri, 99, 10).unwrap();
    assert!(empty.is_empty());
    assert_eq!(total_eof, 16);
}

#[test]
fn read_file_range_rejects_non_local_scheme() {
    let vfs = VfsFilesystem::local_only();
    let uri =
        ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/etc/hostname").unwrap();

    let error = vfs.read_file_range(&uri, 0, 16).unwrap_err();
    assert_eq!(error.code(), "unsupported_provider");
}

#[test]
fn write_file_atomic_creates_new_file() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("hello.txt");
    let uri = ResourceUri::from_local_path(&target).unwrap();

    let vfs = VfsFilesystem::local_only();
    vfs.write_file_atomic(&uri, b"hello world").unwrap();

    let content = std::fs::read(&target).unwrap();
    assert_eq!(content, b"hello world");

    let leftovers: Vec<_> = std::fs::read_dir(dir.path())
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name() != "hello.txt")
        .collect();
    assert!(leftovers.is_empty(), "temp files should be cleaned up");
}

#[test]
fn write_file_atomic_replaces_existing_file() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(b"old contents").unwrap();
    let path = file.path().to_path_buf();
    let uri = ResourceUri::from_local_path(&path).unwrap();

    let vfs = VfsFilesystem::local_only();
    vfs.write_file_atomic(&uri, b"new contents").unwrap();

    let content = std::fs::read(&path).unwrap();
    assert_eq!(content, b"new contents");
}

#[test]
fn write_file_atomic_rejects_missing_parent() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("does-not-exist/file.txt");
    let uri = ResourceUri::from_local_path(&target).unwrap();

    let vfs = VfsFilesystem::local_only();
    let error = vfs.write_file_atomic(&uri, b"x").unwrap_err();
    assert_eq!(error.code(), "destination_missing");
}

#[test]
fn write_file_atomic_rejects_non_local_scheme() {
    let vfs = VfsFilesystem::local_only();
    let uri =
        ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/etc/file.txt").unwrap();

    let error = vfs.write_file_atomic(&uri, b"x").unwrap_err();
    assert_eq!(error.code(), "unsupported_provider");
}
