use config::{AuthKind, NetworkProfile, NetworkProtocolOptions};
use provider_s3::connector::S3Connector;
use remote_core::RemoteConnector;

fn make_profile(host: &str, port: u16, default_path: &str, auth_kind: AuthKind) -> NetworkProfile {
    NetworkProfile {
        id: "test-profile".to_string(),
        label: "Test S3".to_string(),
        scheme: "s3".to_string(),
        host: host.to_string(),
        port,
        username: "access-key".to_string(),
        auth_kind,
        private_key_path: None,
        default_path: default_path.to_string(),
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

#[tokio::test]
async fn s3_connector_scheme() {
    let connector = S3Connector::new();
    assert_eq!(connector.scheme(), "s3");
}

#[tokio::test]
async fn s3_connect_rejects_empty_bucket() {
    let connector = S3Connector::new();
    let profile = make_profile("s3.amazonaws.com", 443, "", AuthKind::AccessKey);
    let secrets = remote_core::AuthSecrets {
        password: Some("secret".to_string()),
        passphrase: None,
    };

    let result = connector.connect(&profile, &secrets).await;
    assert!(result.is_err());
    match result {
        Err(err) => {
            let msg = format!("{err}");
            assert!(msg.contains("bucket"), "expected bucket error, got: {msg}");
        }
        Ok(_) => panic!("expected error for empty bucket"),
    }
}

#[tokio::test]
async fn s3_connect_rejects_private_key_auth() {
    let connector = S3Connector::new();
    let profile = make_profile("s3.amazonaws.com", 443, "/my-bucket", AuthKind::PrivateKey);
    let secrets = remote_core::AuthSecrets {
        password: None,
        passphrase: Some("pass".to_string()),
    };

    let result = connector.connect(&profile, &secrets).await;
    assert!(result.is_err());
    match result {
        Err(err) => {
            let msg = format!("{err}");
            assert!(
                msg.contains("private key"),
                "expected private key rejection, got: {msg}"
            );
        }
        Ok(_) => panic!("expected error for private key auth"),
    }
}

#[tokio::test]
async fn s3_connect_rejects_missing_secret_key() {
    let connector = S3Connector::new();
    let profile = make_profile("s3.amazonaws.com", 443, "/my-bucket", AuthKind::AccessKey);
    let secrets = remote_core::AuthSecrets {
        password: None,
        passphrase: None,
    };

    let result = connector.connect(&profile, &secrets).await;
    assert!(result.is_err());
    match result {
        Err(err) => {
            let msg = format!("{err}");
            assert!(
                msg.contains("secret") || msg.contains("password"),
                "expected secret key error, got: {msg}"
            );
        }
        Ok(_) => panic!("expected error for missing secret key"),
    }
}
