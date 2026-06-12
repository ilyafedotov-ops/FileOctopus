use std::path::Path;

use fs_core::placeholder::{
    attributes_indicate_placeholder, classify_timed_out_path, classify_timed_out_uri,
    flags_indicate_placeholder, is_placeholder_path, FILE_ATTRIBUTE_OFFLINE,
    FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS, FILE_ATTRIBUTE_RECALL_ON_OPEN, SF_DATALESS,
};
use vfs::ResourceUri;

#[test]
fn dataless_flag_is_detected() {
    assert!(flags_indicate_placeholder(SF_DATALESS));
    assert!(flags_indicate_placeholder(SF_DATALESS | 0x1));
    assert!(!flags_indicate_placeholder(0));
    assert!(!flags_indicate_placeholder(0x1));
}

#[test]
fn windows_recall_attributes_are_detected() {
    assert!(attributes_indicate_placeholder(FILE_ATTRIBUTE_OFFLINE));
    assert!(attributes_indicate_placeholder(
        FILE_ATTRIBUTE_RECALL_ON_OPEN
    ));
    assert!(attributes_indicate_placeholder(
        FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS
    ));
    assert!(!attributes_indicate_placeholder(0x20));
    assert!(!attributes_indicate_placeholder(0));
}

#[test]
fn regular_file_is_not_a_placeholder() {
    let path = std::env::temp_dir().join(format!("fo-placeholder-{}", std::process::id()));
    std::fs::write(&path, b"data").unwrap();
    assert!(!is_placeholder_path(&path));
    std::fs::remove_file(&path).ok();
}

#[test]
fn missing_file_is_not_a_placeholder() {
    assert!(!is_placeholder_path(Path::new(
        "/nonexistent/fo-placeholder"
    )));
}

#[test]
fn timed_out_on_regular_file_classifies_as_timeout() {
    let path = std::env::temp_dir().join(format!("fo-timeout-{}", std::process::id()));
    std::fs::write(&path, b"data").unwrap();
    let error = std::io::Error::from_raw_os_error(60);
    let uri = ResourceUri::from_local_path(&path).unwrap();

    assert_eq!(classify_timed_out_uri(&uri, &error).code(), "timeout");
    assert_eq!(classify_timed_out_path(&path, &error).code(), "timeout");
    std::fs::remove_file(&path).ok();
}
