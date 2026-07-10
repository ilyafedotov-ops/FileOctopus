mod support;

use config::{AuthKind, NetworkProfile, NetworkProtocolOptions};
use provider_webdav::WebDavConnector;
use remote_core::{AuthSecrets, RemoteConnector};
use support::{MockResponse, MockServer};

fn profile(host: &str, port: u16) -> NetworkProfile {
    NetworkProfile {
        id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
        label: "WebDAV".to_string(),
        scheme: "webdav".to_string(),
        host: host.to_string(),
        port,
        username: "user".to_string(),
        auth_kind: AuthKind::Password,
        private_key_path: None,
        default_path: "/dav/root/".to_string(),
        host_key_fingerprint: None,
        sort_order: 0,
        last_connected_at: None,
        last_error: None,
        has_stored_secret: true,
        options: NetworkProtocolOptions::default(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    }
}

#[test]
fn production_connector_requires_https_regardless_of_port() {
    let connector = WebDavConnector::new();
    let origin = connector
        .origin_for_profile(&profile("example.com", 80))
        .unwrap();
    assert_eq!(origin.scheme(), "https");
    assert_eq!(origin.port(), Some(80));
}

#[test]
fn connector_rejects_hosts_that_embed_urls_or_paths() {
    let connector = WebDavConnector::new();
    for host in ["http://example.com", "example.com/dav", "user@example.com"] {
        assert!(connector.origin_for_profile(&profile(host, 443)).is_err());
    }
}

#[test]
fn test_policy_allows_http_only_for_loopback() {
    let connector = WebDavConnector::with_http_loopback_for_tests();
    assert_eq!(
        connector
            .origin_for_profile(&profile("127.0.0.1", 8080))
            .unwrap()
            .scheme(),
        "http"
    );
    assert_eq!(
        connector
            .origin_for_profile(&profile("example.com", 8080))
            .unwrap()
            .scheme(),
        "https"
    );
}

#[tokio::test]
async fn connector_authenticates_with_propfind() {
    let server = MockServer::start(|_, _| {
        MockResponse::new(
            207,
            "<d:multistatus xmlns:d=\"DAV:\"><d:response><d:href>/dav/root/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>",
        )
        .header("Content-Type", "application/xml")
    })
    .await;
    let url = reqwest::Url::parse(server.origin()).unwrap();
    let connector = WebDavConnector::with_http_loopback_for_tests();
    let result = connector
        .connect(
            &profile(url.host_str().unwrap(), url.port().unwrap()),
            &AuthSecrets {
                password: Some("pass".to_string()),
                passphrase: None,
            },
        )
        .await;

    assert!(result.is_ok());
    let requests = server.wait_for_requests(1).await;
    assert_eq!(requests[0].method, "PROPFIND");
    assert_eq!(requests[0].path, "/dav/root/");
    assert!(requests[0].headers.contains_key("authorization"));
    assert!(!requests[0].body.is_empty());
}

#[tokio::test]
async fn connector_rejects_non_password_auth() {
    let connector = WebDavConnector::new();
    let mut profile = profile("example.com", 443);
    profile.auth_kind = AuthKind::PrivateKey;
    let result = connector
        .connect(
            &profile,
            &AuthSecrets {
                password: None,
                passphrase: None,
            },
        )
        .await;
    assert!(result.is_err());
}
