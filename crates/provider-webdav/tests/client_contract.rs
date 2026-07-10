mod support;

use std::io::Write;

use provider_webdav::{DavDepth, WebDavClient, WebDavError, WriteCondition};
use reqwest::Url;
use support::{MockResponse, MockServer};

const MULTISTATUS: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/root/</d:href>
    <d:propstat><d:prop><d:displayname>root</d:displayname><d:resourcetype><d:collection/></d:resourcetype><d:getetag>"root-v1"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/root/hello%20world.txt</d:href>
    <d:propstat><d:prop><d:displayname>hello world.txt</d:displayname><d:resourcetype/><d:getcontentlength>12</d:getcontentlength><d:getlastmodified>Wed, 10 Jul 2024 09:30:00 GMT</d:getlastmodified><d:creationdate>2024-07-09T08:00:00Z</d:creationdate><d:getetag>"file-v1"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/root/private.txt</d:href>
    <d:propstat><d:prop><d:displayname>private.txt</d:displayname></d:prop><d:status>HTTP/1.1 403 Forbidden</d:status></d:propstat>
  </d:response>
</d:multistatus>"#;

fn client(origin: &str) -> WebDavClient {
    WebDavClient::with_http_loopback_for_tests(
        Url::parse(origin).unwrap(),
        "user".to_string(),
        "pass".to_string(),
    )
    .unwrap()
}

#[tokio::test]
async fn propfind_parses_207_resources_and_metadata() {
    let server = MockServer::start(|_, _| {
        MockResponse::new(207, MULTISTATUS).header("Content-Type", "application/xml")
    })
    .await;
    let resources = client(server.origin())
        .propfind("/dav/root/", DavDepth::One)
        .await
        .unwrap();

    assert_eq!(resources.len(), 2);
    assert!(resources[0].is_collection);
    assert_eq!(resources[0].etag.as_deref(), Some("\"root-v1\""));
    assert_eq!(
        resources[1].display_name.as_deref(),
        Some("hello world.txt")
    );
    assert_eq!(resources[1].content_length, Some(12));
    assert_eq!(resources[1].etag.as_deref(), Some("\"file-v1\""));
    assert!(resources[1].modified_at.is_some());
    assert!(resources[1].created_at.is_some());

    let requests = server.wait_for_requests(1).await;
    assert_eq!(requests[0].method, "PROPFIND");
    assert_eq!(requests[0].path, "/dav/root/");
    assert_eq!(
        requests[0].headers.get("depth").map(String::as_str),
        Some("1")
    );
    assert_eq!(
        requests[0].headers.get("authorization").map(String::as_str),
        Some("Basic dXNlcjpwYXNz")
    );
}

#[tokio::test]
async fn requests_encode_each_path_segment_once() {
    let server = MockServer::start(|request, _| {
        let href = request.path.clone();
        MockResponse::new(
            207,
            format!(
                "<d:multistatus xmlns:d=\"DAV:\"><d:response><d:href>{href}</d:href><d:propstat><d:prop><d:displayname>report</d:displayname><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>"
            ),
        )
    })
    .await;
    let client = client(server.origin());
    let resources = client
        .propfind("/dav/folder name/%23report.txt", DavDepth::Zero)
        .await
        .unwrap();

    let requests = server.wait_for_requests(1).await;
    assert_eq!(requests[0].path, "/dav/folder%20name/%23report.txt");
    assert_eq!(
        client.href_path(&resources[0].href).unwrap(),
        "/dav/folder name/#report.txt"
    );
}

#[tokio::test]
async fn conditional_put_sends_etag_and_maps_precondition_conflict() {
    let server = MockServer::start(|_, _| MockResponse::new(412, Vec::new())).await;
    let error = client(server.origin())
        .put_bytes(
            "/dav/root/file.txt",
            b"replacement".to_vec(),
            WriteCondition::IfMatch("\"file-v1\"".to_string()),
        )
        .await
        .unwrap_err();

    assert!(error.is_conflict());
    assert_eq!(
        error.status(),
        Some(reqwest::StatusCode::PRECONDITION_FAILED)
    );
    let requests = server.wait_for_requests(1).await;
    assert_eq!(requests[0].method, "PUT");
    assert_eq!(
        requests[0].headers.get("if-match").map(String::as_str),
        Some("\"file-v1\"")
    );
    assert_eq!(requests[0].body, b"replacement");
}

#[tokio::test]
async fn create_only_put_uses_if_none_match() {
    let server = MockServer::start(|_, _| MockResponse::new(201, Vec::new())).await;
    client(server.origin())
        .put_bytes("/dav/root/new.txt", Vec::new(), WriteCondition::CreateOnly)
        .await
        .unwrap();

    let requests = server.wait_for_requests(1).await;
    assert_eq!(
        requests[0].headers.get("if-none-match").map(String::as_str),
        Some("*")
    );
}

#[tokio::test]
async fn dav_mutations_use_typed_methods_and_safe_destination_headers() {
    let server = MockServer::start(|request, _| {
        let status = match request.method.as_str() {
            "MKCOL" | "MOVE" | "COPY" => 201,
            "DELETE" => 204,
            _ => 500,
        };
        MockResponse::new(status, Vec::new())
    })
    .await;
    let client = client(server.origin());
    client.mkcol("/dav/new folder").await.unwrap();
    client
        .delete("/dav/old.txt", Some("\"old-v1\""))
        .await
        .unwrap();
    client
        .move_resource(
            "/dav/source file.txt",
            "/dav/destination file.txt",
            Some("\"source-v1\""),
            false,
        )
        .await
        .unwrap();
    client
        .copy_resource(
            "/dav/source file.txt",
            "/dav/copy file.txt",
            Some("\"source-v1\""),
            false,
        )
        .await
        .unwrap();

    let requests = server.wait_for_requests(4).await;
    assert_eq!(
        requests
            .iter()
            .map(|request| request.method.as_str())
            .collect::<Vec<_>>(),
        vec!["MKCOL", "DELETE", "MOVE", "COPY"]
    );
    assert_eq!(requests[0].path, "/dav/new%20folder");
    assert_eq!(
        requests[1].headers.get("if-match").map(String::as_str),
        Some("\"old-v1\"")
    );
    assert_eq!(requests[2].path, "/dav/source%20file.txt");
    assert_eq!(
        requests[2].headers.get("overwrite").map(String::as_str),
        Some("F")
    );
    assert_eq!(
        requests[2].headers.get("if-match").map(String::as_str),
        Some("\"source-v1\"")
    );
    assert!(requests[2]
        .headers
        .get("destination")
        .is_some_and(|value| value.ends_with("/dav/destination%20file.txt")));
    assert!(requests[3]
        .headers
        .get("destination")
        .is_some_and(|value| value.ends_with("/dav/copy%20file.txt")));
}

#[tokio::test]
async fn same_origin_redirect_is_followed_with_credentials() {
    let server = MockServer::start(|request, _| {
        if request.path == "/dav/start" {
            MockResponse::new(307, Vec::new()).header("Location", "/dav/final")
        } else {
            MockResponse::new(207, MULTISTATUS)
        }
    })
    .await;
    client(server.origin())
        .propfind("/dav/start", DavDepth::Zero)
        .await
        .unwrap();

    let requests = server.wait_for_requests(2).await;
    assert_eq!(requests[0].path, "/dav/start");
    assert_eq!(requests[1].path, "/dav/final");
    assert!(requests.iter().all(|request| request
        .headers
        .get("authorization")
        .is_some_and(|value| value == "Basic dXNlcjpwYXNz")));
}

#[tokio::test]
async fn streamed_put_replays_disk_body_across_same_origin_redirect() {
    let server = MockServer::start(|request, _| {
        if request.path == "/dav/start" {
            MockResponse::new(307, Vec::new()).header("Location", "/dav/final")
        } else {
            MockResponse::new(204, Vec::new())
        }
    })
    .await;
    let payload = vec![0x5a; 1024 * 1024];
    let mut staged = tempfile::tempfile().unwrap();
    staged.write_all(&payload).unwrap();
    client(server.origin())
        .put_file(
            "/dav/start",
            staged,
            payload.len() as u64,
            WriteCondition::IfMatch("\"file-v1\"".to_string()),
        )
        .await
        .unwrap();

    let requests = server.wait_for_requests(2).await;
    assert_eq!(requests[0].body, payload);
    assert_eq!(requests[1].body, payload);
    assert!(requests.iter().all(|request| {
        request.headers.get("if-match").map(String::as_str) == Some("\"file-v1\"")
    }));
}

#[tokio::test]
async fn cross_origin_redirect_is_rejected_before_credentials_are_forwarded() {
    let target = MockServer::start(|_, _| MockResponse::new(200, Vec::new())).await;
    let target_url = format!("{}/capture", target.origin()).replacen(
        "http://",
        "http://redirect-user:redirect-secret@",
        1,
    );
    let source = MockServer::start(move |_, _| {
        MockResponse::new(307, Vec::new()).header("Location", target_url.clone())
    })
    .await;
    let error = client(source.origin())
        .propfind("/dav/source", DavDepth::Zero)
        .await
        .unwrap_err();

    assert!(matches!(error, WebDavError::RedirectRejected { .. }));
    let message = error.to_string();
    assert!(!message.contains("user"));
    assert!(!message.contains("pass"));
    assert!(!message.contains("secret"));
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    assert!(target.requests().is_empty());
}

#[tokio::test]
async fn range_get_is_bounded_when_server_ignores_range() {
    let server = MockServer::start(|_, _| MockResponse::new(200, b"0123456789".to_vec())).await;
    let bytes = client(server.origin())
        .get_prefix("/dav/root/file.txt", 4)
        .await
        .unwrap();

    assert_eq!(bytes, b"0123");
    let requests = server.wait_for_requests(1).await;
    assert_eq!(
        requests[0].headers.get("range").map(String::as_str),
        Some("bytes=0-3")
    );
}

#[test]
fn general_http_origins_are_rejected() {
    let error = WebDavClient::new(
        Url::parse("http://example.com").unwrap(),
        "user".to_string(),
        "pass".to_string(),
    )
    .err()
    .unwrap();
    assert!(matches!(error, WebDavError::InvalidUrl(_)));
}

#[test]
fn dtd_and_general_entities_are_rejected() {
    let xml = r#"<!DOCTYPE x [<!ENTITY secret "value">]><d:multistatus xmlns:d="DAV:"><d:response><d:href>&secret;</d:href></d:response></d:multistatus>"#;
    let error = provider_webdav::client::parse_multistatus(xml).unwrap_err();
    assert!(matches!(error, WebDavError::InvalidXml(_)));
}

#[test]
fn predefined_and_numeric_entities_are_decoded_without_dtd_expansion() {
    let xml = r#"<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/a%20b</d:href><d:propstat><d:prop><d:displayname>A &amp; B &#35;1</d:displayname><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>"#;
    let resources = provider_webdav::client::parse_multistatus(xml).unwrap();
    assert_eq!(resources[0].display_name.as_deref(), Some("A & B #1"));
}
