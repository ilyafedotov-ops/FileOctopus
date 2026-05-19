use provider_sftp::sha256_base64_fingerprint;

#[test]
fn produces_openssh_style_sha256_label() {
    let blob = b"\x00\x01\x02\x03\x04test-key-bytes";
    let fingerprint = sha256_base64_fingerprint(blob);

    assert!(
        fingerprint.starts_with("SHA256:"),
        "fingerprint should be prefixed with `SHA256:`, got {fingerprint}"
    );

    let suffix = fingerprint.trim_start_matches("SHA256:");
    assert!(
        !suffix.ends_with('='),
        "OpenSSH strips base64 padding from fingerprints, got {fingerprint}"
    );
    assert!(suffix
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/'));
    assert_eq!(suffix.len(), 43);
}

#[test]
fn fingerprint_is_deterministic() {
    let blob = b"deterministic input";
    assert_eq!(
        sha256_base64_fingerprint(blob),
        sha256_base64_fingerprint(blob),
    );
}

#[test]
fn fingerprint_changes_when_blob_changes() {
    let a = sha256_base64_fingerprint(b"server-a");
    let b = sha256_base64_fingerprint(b"server-b");
    assert_ne!(a, b);
}
