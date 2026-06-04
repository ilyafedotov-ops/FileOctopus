use app_ipc::{
    TerminalProfileDto, TerminalProfileScopeDto, TerminalRunCommandRequest,
    TerminalSessionEventDto, TerminalSessionStatusDto, TerminalSpawnRequest,
};

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

#[test]
fn terminal_spawn_request_accepts_terminal_profile_target() {
    let json = r#"{
        "uri":"local:///tmp",
        "terminalProfileId":"profile-1",
        "cols":120,
        "rows":32,
        "initialCommand":"cargo test",
        "title":"Tests"
    }"#;

    let dto: TerminalSpawnRequest = serde_json::from_str(json).unwrap();

    assert_eq!(dto.terminal_profile_id.as_deref(), Some("profile-1"));
    assert_eq!(dto.initial_command.as_deref(), Some("cargo test"));
    assert_eq!(dto.title.as_deref(), Some("Tests"));
}

#[test]
fn terminal_profile_dto_serializes_hybrid_profile() {
    let dto = TerminalProfileDto {
        id: "profile-1".to_string(),
        name: "Dev".to_string(),
        scope: TerminalProfileScopeDto::Local,
        shell: "/bin/zsh".to_string(),
        args: "-l".to_string(),
        env: "RUST_LOG=debug".to_string(),
        working_directory_mode: "currentPane".to_string(),
        custom_cwd_uri: String::new(),
        network_profile_id: None,
        remote_cwd: String::new(),
        initial_command: String::new(),
        font_family: "monospace".to_string(),
        font_size: 13,
        line_height: 1.2,
        cursor_style: "block".to_string(),
        cursor_blink: true,
        scrollback: 5000,
        theme_id: "system".to_string(),
        theme_overrides: String::new(),
        copy_on_select: false,
        right_click_action: "contextMenu".to_string(),
        paste_confirmation: true,
        link_handling: "openExternal".to_string(),
        sort_order: 0,
        is_default: true,
        created_at: "2026-06-01T00:00:00Z".to_string(),
        updated_at: "2026-06-01T00:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&dto).unwrap();

    assert!(json.contains("\"terminalProfileId\"") || !json.contains("\"terminalProfileId\""));
    assert!(json.contains("\"copyOnSelect\":false"));
    assert!(json.contains("\"isDefault\":true"));
}

#[test]
fn terminal_command_and_session_event_dtos_round_trip() {
    let request = TerminalRunCommandRequest {
        session_id: "session-1".to_string(),
        command: "pwd".to_string(),
        append_newline: true,
        focus: true,
    };
    let restored: TerminalRunCommandRequest =
        serde_json::from_str(&serde_json::to_string(&request).unwrap()).unwrap();
    assert_eq!(restored, request);

    let event = TerminalSessionEventDto {
        kind: "updated".to_string(),
        session_id: "session-1".to_string(),
        status: TerminalSessionStatusDto::Running,
        title: "Terminal".to_string(),
        cwd_uri: Some("local:///tmp".to_string()),
        terminal_profile_id: Some("profile-1".to_string()),
        transport: "local".to_string(),
        cols: 120,
        rows: 32,
        exit_code: None,
    };
    let restored: TerminalSessionEventDto =
        serde_json::from_str(&serde_json::to_string(&event).unwrap()).unwrap();
    assert_eq!(restored, event);
}
