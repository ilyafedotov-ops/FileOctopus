use app_ipc::{AutostartStatusDto, UserPreferencesDto};

#[test]
fn autostart_dto_round_trip() {
    let value = AutostartStatusDto {
        enabled: true,
        supported: true,
    };
    let json = serde_json::to_string(&value).unwrap();
    assert!(json.contains("\"enabled\":true"));
    assert!(json.contains("\"supported\":true"));
    let restored: AutostartStatusDto = serde_json::from_str(&json).unwrap();
    assert_eq!(restored, value);
}

#[test]
fn preferences_dto_includes_new_fields() {
    let json = r#"{
        "theme":"system","density":"comfortable","defaultViewMode":"details",
        "showHiddenFiles":false,"sidebarWidth":240,"splitRatio":0.5,
        "activityPanelVisible":true,"activityPanelWidth":288,
        "confirmDelete":true,"confirmPermanentDelete":true,
        "useTrashByDefault":true,"defaultConflictPolicy":"fail",
        "accentColor":"violet","fontScale":"large","iconScale":"small",
        "confirmOverwrite":false,"sidebarVisible":true,
        "statusBarVisible":true,"toolbarVisible":false,
        "paneMode":"single","jobDrawerBehavior":"openOnError"
    }"#;
    let dto: UserPreferencesDto = serde_json::from_str(json).unwrap();
    assert_eq!(dto.accent_color, "violet");
    assert_eq!(dto.font_scale, "large");
    assert_eq!(dto.icon_scale, "small");
    assert!(!dto.confirm_overwrite);
    assert!(dto.sidebar_visible);
    assert!(dto.status_bar_visible);
    assert!(!dto.toolbar_visible);
    assert_eq!(dto.pane_mode, "single");
    assert_eq!(dto.job_drawer_behavior, "openOnError");
}
