use provider_s3::connector::parse_bucket_key;
use provider_s3::ops::{dir_entry, object_entry};
use provider_s3::ops::{s3_bucket_from_uri_path, s3_prefix_from_uri_path};
use vfs::ResourceUri;

const PROFILE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

#[test]
fn parse_bucket_key_extracts_bucket_and_key() {
    let (bucket, key) = parse_bucket_key("my-bucket/path/to/file.txt");
    assert_eq!(bucket, "my-bucket");
    assert_eq!(key, "path/to/file.txt");
}

#[test]
fn parse_bucket_key_root_has_empty_key() {
    let (bucket, key) = parse_bucket_key("my-bucket");
    assert_eq!(bucket, "my-bucket");
    assert_eq!(key, "");
}

#[test]
fn parse_bucket_key_strips_leading_slash() {
    let (bucket, key) = parse_bucket_key("/my-bucket/path/to/file.txt");
    assert_eq!(bucket, "my-bucket");
    assert_eq!(key, "path/to/file.txt");
}

#[test]
fn prefix_from_uri_path_directory() {
    let prefix = s3_prefix_from_uri_path("/my-bucket/path/to/dir");
    assert_eq!(prefix, "path/to/dir/");
}

#[test]
fn prefix_from_uri_path_root() {
    let prefix = s3_prefix_from_uri_path("/my-bucket");
    assert_eq!(prefix, "");
}

#[test]
fn prefix_from_uri_path_trailing_slash() {
    let prefix = s3_prefix_from_uri_path("/my-bucket/path/to/dir/");
    assert_eq!(prefix, "path/to/dir/");
}

#[test]
fn bucket_name_from_uri_path() {
    assert_eq!(s3_bucket_from_uri_path("/my-bucket/path"), "my-bucket");
    assert_eq!(s3_bucket_from_uri_path("my-bucket"), "my-bucket");
}

#[test]
fn dir_entry_builds_directory_file_entry() {
    let uri = ResourceUri::from_remote_profile("s3", PROFILE_ID, "/my-bucket/photos/").unwrap();
    let entry = dir_entry(&uri, PROFILE_ID, "photos/").unwrap();
    assert_eq!(entry.name, "photos");
    assert!(entry.kind == vfs::FileKind::Directory);
    assert_eq!(entry.provider_id.as_str(), "s3");
}

#[test]
fn object_entry_builds_file_entry_with_metadata() {
    let uri = ResourceUri::from_remote_profile("s3", PROFILE_ID, "/my-bucket/readme.txt").unwrap();
    let entry = object_entry(&uri, PROFILE_ID, "readme.txt", 1024, "2024-01-15T10:30:00Z").unwrap();
    assert_eq!(entry.name, "readme.txt");
    assert!(entry.kind == vfs::FileKind::File);
    assert_eq!(entry.size, Some(1024));
    assert_eq!(entry.extension, Some("txt".to_string()));
    assert!(entry.modified_at.is_some());
    assert_eq!(entry.provider_id.as_str(), "s3");
}

#[test]
fn object_entry_nested_key_extracts_name() {
    let uri = ResourceUri::from_remote_profile("s3", PROFILE_ID, "/my-bucket/a/b/c.txt").unwrap();
    let entry = object_entry(&uri, PROFILE_ID, "a/b/c.txt", 512, "2024-01-15T10:30:00Z").unwrap();
    assert_eq!(entry.name, "c.txt");
}

#[test]
fn object_entry_no_extension() {
    let uri = ResourceUri::from_remote_profile("s3", PROFILE_ID, "/my-bucket/Makefile").unwrap();
    let entry = object_entry(&uri, PROFILE_ID, "Makefile", 100, "2024-01-15T10:30:00Z").unwrap();
    assert_eq!(entry.name, "Makefile");
    assert_eq!(entry.extension, None);
}
