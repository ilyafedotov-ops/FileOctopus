mod support;

use provider_webdav::{WebDavClient, WebDavProvider};
use reqwest::Url;
use support::{MockResponse, MockServer};
use vfs::{FileKind, ListCancellation, ListOptions, ListSessionId, ResourceUri, VfsProvider};

const PROFILE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

fn multistatus_for(path: &str, depth: &str) -> String {
    let self_response = if path.ends_with(".txt") {
        format!(
            "<d:response><d:href>{path}</d:href><d:propstat><d:prop><d:displayname>hello world.txt</d:displayname><d:resourcetype/><d:getcontentlength>12</d:getcontentlength><d:getetag>\"file-v1\"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>"
        )
    } else {
        format!(
            "<d:response><d:href>{path}</d:href><d:propstat><d:prop><d:displayname>root</d:displayname><d:resourcetype><d:collection/></d:resourcetype><d:getetag>\"root-v1\"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>"
        )
    };
    let children = if depth == "1" {
        "<d:response><d:href>/dav/root/hello%20world.txt</d:href><d:propstat><d:prop><d:displayname>hello world.txt</d:displayname><d:resourcetype/><d:getcontentlength>12</d:getcontentlength><d:getetag>\"file-v1\"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response><d:response><d:href>/dav/root/photos/</d:href><d:propstat><d:prop><d:displayname>photos</d:displayname><d:resourcetype><d:collection/></d:resourcetype><d:getetag>\"photos-v1\"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>"
    } else {
        ""
    };
    format!("<d:multistatus xmlns:d=\"DAV:\">{self_response}{children}</d:multistatus>")
}

async fn provider(server: &MockServer) -> WebDavProvider {
    let client = WebDavClient::with_http_loopback_for_tests(
        Url::parse(server.origin()).unwrap(),
        "user".to_string(),
        "pass".to_string(),
    )
    .unwrap();
    WebDavProvider::with_client_for_tests(PROFILE_ID.to_string(), client)
}

#[tokio::test]
async fn provider_stat_maps_typed_propfind_metadata() {
    let server = MockServer::start(|request, _| {
        MockResponse::new(
            207,
            multistatus_for(&request.path, request.headers.get("depth").unwrap()),
        )
        .header("Content-Type", "application/xml")
    })
    .await;
    let provider = provider(&server).await;
    let uri = ResourceUri::from_remote_profile("webdav", PROFILE_ID, "/dav/root/hello world.txt")
        .unwrap();

    let entry = provider.stat(&uri).await.unwrap();

    assert_eq!(entry.name, "hello world.txt");
    assert_eq!(entry.kind, FileKind::File);
    assert_eq!(entry.size, Some(12));
    assert_eq!(entry.provider_id.as_str(), "webdav");
    let requests = server.wait_for_requests(1).await;
    assert_eq!(requests[0].method, "PROPFIND");
    assert_eq!(requests[0].path, "/dav/root/hello%20world.txt");
    assert!(!requests[0].body.is_empty());
    assert_eq!(
        requests[0].headers.get("depth").map(String::as_str),
        Some("0")
    );
}

#[tokio::test]
async fn provider_list_filters_self_and_emits_typed_entries() {
    let server = MockServer::start(|request, _| {
        MockResponse::new(
            207,
            multistatus_for(&request.path, request.headers.get("depth").unwrap()),
        )
    })
    .await;
    let provider = provider(&server).await;
    let uri = ResourceUri::from_remote_profile("webdav", PROFILE_ID, "/dav/root/").unwrap();
    let (sink, mut receiver) = tokio::sync::mpsc::channel(4);

    provider
        .list(
            &uri,
            ListOptions {
                session_id: ListSessionId::new("session"),
                request_id: "request".to_string(),
                batch_size: 1,
                include_hidden: true,
                cancel: ListCancellation::new(),
            },
            sink,
        )
        .await
        .unwrap();

    let first = receiver.recv().await.unwrap();
    let second = receiver.recv().await.unwrap();
    assert_eq!(first.entries[0].name, "hello world.txt");
    assert_eq!(first.entries[0].kind, FileKind::File);
    assert_eq!(first.entries[0].size, Some(12));
    assert!(!first.is_complete);
    assert_eq!(second.entries[0].name, "photos");
    assert_eq!(second.entries[0].kind, FileKind::Directory);
    assert!(second.is_complete);
    assert_eq!(second.total_hint, Some(2));
}

#[tokio::test]
async fn provider_non_recursive_remove_does_not_delete_populated_collection() {
    let server = MockServer::start(|request, _| {
        MockResponse::new(
            207,
            multistatus_for(&request.path, request.headers.get("depth").unwrap()),
        )
    })
    .await;
    let provider = provider(&server).await;
    let uri = ResourceUri::from_remote_profile("webdav", PROFILE_ID, "/dav/root/").unwrap();

    let error = provider.remove(&uri, false).await.unwrap_err();

    assert_eq!(error.code(), "internal");
    let requests = server.wait_for_requests(2).await;
    assert_eq!(requests.len(), 2);
    assert!(requests.iter().all(|request| request.method == "PROPFIND"));
}

#[tokio::test]
async fn provider_streams_large_disk_staged_put_with_etag_condition() {
    let server = MockServer::start(|request, _| {
        if request.method == "PUT" {
            MockResponse::new(204, Vec::new())
        } else {
            MockResponse::new(
                207,
                multistatus_for(&request.path, request.headers.get("depth").unwrap()),
            )
        }
    })
    .await;
    let provider = provider(&server).await;
    let uri =
        ResourceUri::from_remote_profile("webdav", PROFILE_ID, "/dav/root/large.txt").unwrap();
    let payload = vec![0x5a; 2 * 1024 * 1024];

    let total = provider
        .write_file_from_reader(
            &uri,
            Box::new(std::io::Cursor::new(payload.clone())),
            Box::new(|_| {}),
        )
        .await
        .unwrap();

    assert_eq!(total, payload.len() as u64);
    let requests = server.wait_for_requests(2).await;
    assert_eq!(requests[1].method, "PUT");
    assert_eq!(requests[1].body, payload);
    assert_eq!(
        requests[1]
            .headers
            .get("content-length")
            .map(String::as_str),
        Some("2097152")
    );
    assert_eq!(
        requests[1].headers.get("if-match").map(String::as_str),
        Some("\"file-v1\"")
    );
}
