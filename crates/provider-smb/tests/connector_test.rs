use config::{AuthKind, NetworkProfile, NetworkProtocolOptions};
use provider_smb::connector::SmbConnector;
use remote_core::{AuthSecrets, RemoteConnector};

fn make_profile(host: &str, port: u16, auth_kind: AuthKind) -> NetworkProfile {
    NetworkProfile {
        id: "test-profile".to_string(),
        label: "Test".to_string(),
        scheme: "smb".to_string(),
        host: host.to_string(),
        port,
        username: "user".to_string(),
        auth_kind,
        private_key_path: None,
        default_path: "/share".to_string(),
        host_key_fingerprint: None,
        sort_order: 0,
        last_connected_at: None,
        last_error: None,
        has_stored_secret: false,
        options: NetworkProtocolOptions::default(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    }
}

fn make_secrets(password: Option<&str>) -> AuthSecrets {
    AuthSecrets {
        password: password.map(str::to_string),
        passphrase: None,
    }
}

#[tokio::test]
async fn smb_connector_scheme() {
    let connector = SmbConnector::new();
    assert_eq!(connector.scheme(), "smb");
}

#[tokio::test]
async fn smb_connect_rejects_private_key_auth() {
    let connector = SmbConnector::new();
    let profile = make_profile("smb.local", 445, AuthKind::PrivateKey);
    let secrets = make_secrets(None);

    let result = connector.connect(&profile, &secrets).await;
    assert!(result.is_err());
    match result {
        Err(err) => {
            let msg = format!("{err}");
            assert!(
                msg.contains("private key") || msg.contains("PrivateKey"),
                "expected private key rejection, got: {msg}"
            );
        }
        Ok(_) => panic!("expected error"),
    }
}

#[tokio::test]
async fn smb_connect_rejects_missing_password() {
    let connector = SmbConnector::new();
    let profile = make_profile("smb.local", 445, AuthKind::Password);
    let secrets = make_secrets(None);

    let result = connector.connect(&profile, &secrets).await;
    assert!(result.is_err());
    match result {
        Err(err) => {
            let msg = format!("{err}");
            assert!(
                msg.contains("missing password"),
                "expected missing password error, got: {msg}"
            );
        }
        Ok(_) => panic!("expected error"),
    }
}
