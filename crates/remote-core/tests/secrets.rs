use config::{AuthKind, NetworkProfileRepository, NewNetworkProfile, UpdateNetworkProfile};
use remote_core::AuthSecrets;
use tempfile::TempDir;

fn profile_with(auth_kind: AuthKind, private_key_path: Option<String>) -> NewNetworkProfile {
    NewNetworkProfile {
        label: "test".into(),
        scheme: "sftp".into(),
        host: "example.invalid".into(),
        port: 22,
        username: "u".into(),
        auth_kind,
        private_key_path,
        default_path: "/".into(),
    }
}

#[test]
fn private_key_with_empty_path_has_no_stored_secret() {
    let temp = TempDir::new().unwrap();
    let repository = NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(AuthKind::PrivateKey, Some(String::new())))
        .unwrap();

    assert!(!AuthSecrets::profile_has_stored_secret(&profile));
}

#[test]
fn private_key_with_path_reports_stored_secret() {
    let temp = TempDir::new().unwrap();
    let repository = NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(
            AuthKind::PrivateKey,
            Some("/home/u/.ssh/id_ed25519".into()),
        ))
        .unwrap();

    assert!(AuthSecrets::profile_has_stored_secret(&profile));
}

#[test]
fn password_profile_uses_persisted_secret_flag() {
    let temp = TempDir::new().unwrap();
    let repository = NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(AuthKind::Password, None))
        .unwrap();

    assert!(!AuthSecrets::profile_has_stored_secret(&profile));

    repository
        .set_has_stored_secret(&profile.id, true)
        .expect("set flag");
    let updated = repository.get(&profile.id).unwrap();
    assert!(AuthSecrets::profile_has_stored_secret(&updated));
}

#[test]
fn private_key_update_round_trips_key_path() {
    let temp = TempDir::new().unwrap();
    let repository = NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(AuthKind::PrivateKey, Some("/old".into())))
        .unwrap();

    let updated = repository
        .update(
            &profile.id,
            UpdateNetworkProfile {
                label: profile.label.clone(),
                host: profile.host.clone(),
                port: profile.port,
                username: profile.username.clone(),
                auth_kind: AuthKind::PrivateKey,
                private_key_path: Some("/new".into()),
                default_path: profile.default_path.clone(),
            },
        )
        .unwrap();

    assert_eq!(updated.private_key_path.as_deref(), Some("/new"));
    assert!(AuthSecrets::profile_has_stored_secret(&updated));
}
