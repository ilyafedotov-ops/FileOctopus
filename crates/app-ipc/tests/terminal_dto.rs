use app_ipc::TerminalSpawnRequest;

#[test]
fn terminal_spawn_request_accepts_remote_profile_target() {
    let json = r#"{
        "profileId":"550e8400-e29b-41d4-a716-446655440000",
        "cols":120,
        "rows":32
    }"#;

    let dto: TerminalSpawnRequest = serde_json::from_str(json).unwrap();

    assert_eq!(
        dto.profile_id.as_deref(),
        Some("550e8400-e29b-41d4-a716-446655440000")
    );
    assert_eq!(dto.uri, None);
    assert_eq!(dto.cols, 120);
    assert_eq!(dto.rows, 32);
}
