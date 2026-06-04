use config::{
    NewTerminalProfile, TerminalProfileRepository, TerminalProfileScope, UpdateTerminalProfile,
};

#[test]
fn terminal_profiles_seed_default_and_support_crud() {
    let dir = tempfile::tempdir().unwrap();
    let repository = TerminalProfileRepository::new(dir.path().join("terminal.sqlite")).unwrap();

    let profiles = repository.list().unwrap();
    assert_eq!(profiles.len(), 1);
    assert!(profiles[0].is_default);
    assert_eq!(profiles[0].name, "Default");

    let created = repository
        .add(NewTerminalProfile {
            name: "Dev Shell".to_string(),
            scope: TerminalProfileScope::Local,
            shell: "/bin/zsh".to_string(),
            args: "-l\n--interactive".to_string(),
            env: "RUST_LOG=debug".to_string(),
            working_directory_mode: "currentPane".to_string(),
            custom_cwd_uri: String::new(),
            network_profile_id: None,
            remote_cwd: String::new(),
            initial_command: "pwd".to_string(),
            font_family: "JetBrains Mono".to_string(),
            font_size: 15,
            line_height: 1.25,
            cursor_style: "bar".to_string(),
            cursor_blink: true,
            scrollback: 10000,
            theme_id: "dark".to_string(),
            theme_overrides: String::new(),
            copy_on_select: true,
            right_click_action: "paste".to_string(),
            paste_confirmation: true,
            link_handling: "openExternal".to_string(),
        })
        .unwrap();

    assert_eq!(created.sort_order, 1);
    repository.set_default(&created.id).unwrap();
    let default = repository.default_profile().unwrap();
    assert_eq!(default.id, created.id);

    let updated = repository
        .update(
            &created.id,
            UpdateTerminalProfile {
                name: "Work Shell".to_string(),
                scope: TerminalProfileScope::Local,
                shell: "/bin/bash".to_string(),
                args: "-l".to_string(),
                env: String::new(),
                working_directory_mode: "home".to_string(),
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
            },
        )
        .unwrap();

    assert_eq!(updated.name, "Work Shell");
    assert_eq!(updated.working_directory_mode, "home");

    let original_default = profiles[0].id.clone();
    repository.delete(&original_default).unwrap();
    assert!(repository.delete(&created.id).is_err());
}
