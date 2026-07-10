use std::fs::File;
use std::io::{Seek, SeekFrom, Write};
use std::net::IpAddr;
use std::str::FromStr;
use std::time::Duration;

use chrono::{DateTime, Utc};
use percent_encoding::percent_decode_str;
use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::header::{
    HeaderMap, HeaderValue, CONTENT_LENGTH, CONTENT_TYPE, IF_MATCH, IF_NONE_MATCH, LOCATION, RANGE,
};
use reqwest::redirect::Policy;
use reqwest::{Body, Client, Method, Response, StatusCode, Url};
use thiserror::Error;

const MAX_XML_BYTES: usize = 16 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;
const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:creationdate/><d:getetag/></d:prop></d:propfind>"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DavDepth {
    Zero,
    One,
}

impl DavDepth {
    fn header_value(self) -> &'static str {
        match self {
            Self::Zero => "0",
            Self::One => "1",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WriteCondition {
    Overwrite,
    CreateOnly,
    IfMatch(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DavResource {
    pub href: String,
    pub display_name: Option<String>,
    pub is_collection: bool,
    pub content_length: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub etag: Option<String>,
}

#[derive(Debug, Error)]
pub enum WebDavError {
    #[error("invalid WebDAV URL: {0}")]
    InvalidUrl(String),
    #[error("invalid WebDAV header: {0}")]
    InvalidHeader(String),
    #[error("WebDAV transport failed: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("WebDAV XML response is invalid: {0}")]
    InvalidXml(String),
    #[error("WebDAV response exceeded the {limit} byte limit")]
    ResponseTooLarge { limit: usize },
    #[error("WebDAV redirect from `{from}` to `{to}` was rejected")]
    RedirectRejected { from: String, to: String },
    #[error("WebDAV redirect limit exceeded for `{url}`")]
    RedirectLimit { url: String },
    #[error("WebDAV authentication failed for `{url}` ({status})")]
    Authentication { url: String, status: StatusCode },
    #[error("WebDAV resource was not found: `{url}`")]
    NotFound { url: String },
    #[error("WebDAV resource conflict for `{url}` ({status})")]
    Conflict { url: String, status: StatusCode },
    #[error("WebDAV request failed for `{url}` ({status})")]
    Status { url: String, status: StatusCode },
    #[error("WebDAV I/O failed: {0}")]
    Io(#[from] std::io::Error),
}

impl WebDavError {
    pub fn status(&self) -> Option<StatusCode> {
        match self {
            Self::Authentication { status, .. }
            | Self::Conflict { status, .. }
            | Self::Status { status, .. } => Some(*status),
            _ => None,
        }
    }

    pub fn is_conflict(&self) -> bool {
        matches!(self, Self::Conflict { .. })
    }
}

#[derive(Clone)]
pub struct WebDavClient {
    http: Client,
    origin: Url,
    username: String,
    password: String,
}

enum RequestBody {
    Bytes(Vec<u8>),
    File { file: File, length: u64 },
}

impl WebDavClient {
    pub fn new(origin: Url, username: String, password: String) -> Result<Self, WebDavError> {
        Self::new_with_policy(origin, username, password, false)
    }

    #[doc(hidden)]
    pub fn with_http_loopback_for_tests(
        origin: Url,
        username: String,
        password: String,
    ) -> Result<Self, WebDavError> {
        Self::new_with_policy(origin, username, password, true)
    }

    fn new_with_policy(
        origin: Url,
        username: String,
        password: String,
        allow_http_loopback: bool,
    ) -> Result<Self, WebDavError> {
        if !matches!(origin.scheme(), "https" | "http")
            || origin.host_str().is_none()
            || !origin.username().is_empty()
            || origin.password().is_some()
            || (origin.scheme() != "https"
                && !(allow_http_loopback && origin.host_str().is_some_and(is_loopback_host)))
        {
            return Err(WebDavError::InvalidUrl(safe_url(&origin)));
        }

        let mut normalized_origin = origin;
        normalized_origin.set_path("/");
        normalized_origin.set_query(None);
        normalized_origin.set_fragment(None);

        let http = Client::builder()
            .redirect(Policy::none())
            .https_only(normalized_origin.scheme() == "https")
            .connect_timeout(Duration::from_secs(15))
            .read_timeout(Duration::from_secs(60))
            .user_agent("FileOctopus-WebDAV/0.1")
            .build()?;

        Ok(Self {
            http,
            origin: normalized_origin,
            username,
            password,
        })
    }

    pub fn origin(&self) -> &Url {
        &self.origin
    }

    pub fn url_for_path(&self, path: &str) -> Result<Url, WebDavError> {
        if path.contains('\0') {
            return Err(WebDavError::InvalidUrl("path contains NUL".to_string()));
        }

        let trailing_slash = path.ends_with('/') && path != "/";
        let mut url = self.origin.clone();
        {
            let mut segments = url
                .path_segments_mut()
                .map_err(|_| WebDavError::InvalidUrl(self.origin.to_string()))?;
            segments.clear();
            for encoded in path.split('/').filter(|segment| !segment.is_empty()) {
                let decoded = percent_decode_str(encoded)
                    .decode_utf8()
                    .map_err(|error| WebDavError::InvalidUrl(error.to_string()))?;
                if matches!(decoded.as_ref(), "." | "..") {
                    return Err(WebDavError::InvalidUrl(
                        "path traversal segments are not allowed".to_string(),
                    ));
                }
                if decoded.contains('/') {
                    return Err(WebDavError::InvalidUrl(
                        "encoded path separators are not allowed".to_string(),
                    ));
                }
                segments.push(decoded.as_ref());
            }
            if trailing_slash {
                segments.push("");
            }
        }
        Ok(url)
    }

    pub fn href_path(&self, href: &str) -> Result<String, WebDavError> {
        let url = self
            .origin
            .join(href)
            .map_err(|error| WebDavError::InvalidUrl(error.to_string()))?;
        if url.origin() != self.origin.origin()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(WebDavError::InvalidUrl(
                "PROPFIND href is outside the configured origin".to_string(),
            ));
        }

        let trailing_slash = url.path().ends_with('/') && url.path() != "/";
        let mut path = String::from("/");
        let mut first = true;
        for segment in url.path().split('/').filter(|segment| !segment.is_empty()) {
            let decoded = percent_decode_str(segment)
                .decode_utf8()
                .map_err(|error| WebDavError::InvalidUrl(error.to_string()))?;
            if matches!(decoded.as_ref(), "." | "..") {
                return Err(WebDavError::InvalidUrl(
                    "PROPFIND href contains a traversal segment".to_string(),
                ));
            }
            if decoded.contains('/') {
                return Err(WebDavError::InvalidUrl(
                    "PROPFIND href contains an encoded path separator".to_string(),
                ));
            }
            if !first {
                path.push('/');
            }
            path.push_str(decoded.as_ref());
            first = false;
        }
        if trailing_slash && path != "/" {
            path.push('/');
        }
        Ok(path)
    }

    pub async fn propfind(
        &self,
        path: &str,
        depth: DavDepth,
    ) -> Result<Vec<DavResource>, WebDavError> {
        let mut headers = HeaderMap::new();
        insert_header(&mut headers, "depth", depth.header_value())?;
        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("application/xml; charset=utf-8"),
        );
        let response = self
            .send(
                method("PROPFIND")?,
                self.url_for_path(path)?,
                headers,
                Some(RequestBody::Bytes(PROPFIND_BODY.as_bytes().to_vec())),
            )
            .await?;
        if response.status() != StatusCode::MULTI_STATUS {
            return Err(status_error(&response));
        }
        let body = response_bytes_bounded(response, MAX_XML_BYTES).await?;
        let xml = std::str::from_utf8(&body)
            .map_err(|error| WebDavError::InvalidXml(error.to_string()))?;
        parse_multistatus(xml)
    }

    pub async fn mkcol(&self, path: &str) -> Result<(), WebDavError> {
        let response = self
            .send(
                method("MKCOL")?,
                self.url_for_path(path)?,
                HeaderMap::new(),
                None,
            )
            .await?;
        ensure_success(&response)
    }

    pub async fn delete(&self, path: &str, etag: Option<&str>) -> Result<(), WebDavError> {
        let mut headers = HeaderMap::new();
        if let Some(etag) = etag {
            headers.insert(
                IF_MATCH,
                HeaderValue::from_str(etag)
                    .map_err(|error| WebDavError::InvalidHeader(error.to_string()))?,
            );
        }
        let response = self
            .send(Method::DELETE, self.url_for_path(path)?, headers, None)
            .await?;
        ensure_success(&response)
    }

    pub async fn move_resource(
        &self,
        source: &str,
        destination: &str,
        source_etag: Option<&str>,
        overwrite: bool,
    ) -> Result<(), WebDavError> {
        self.copy_or_move(method("MOVE")?, source, destination, source_etag, overwrite)
            .await
    }

    pub async fn copy_resource(
        &self,
        source: &str,
        destination: &str,
        source_etag: Option<&str>,
        overwrite: bool,
    ) -> Result<(), WebDavError> {
        self.copy_or_move(method("COPY")?, source, destination, source_etag, overwrite)
            .await
    }

    async fn copy_or_move(
        &self,
        method: Method,
        source: &str,
        destination: &str,
        source_etag: Option<&str>,
        overwrite: bool,
    ) -> Result<(), WebDavError> {
        let destination = self.url_for_path(destination)?;
        let mut headers = HeaderMap::new();
        insert_header(&mut headers, "destination", destination.as_str())?;
        insert_header(&mut headers, "overwrite", if overwrite { "T" } else { "F" })?;
        if let Some(etag) = source_etag {
            headers.insert(
                IF_MATCH,
                HeaderValue::from_str(etag)
                    .map_err(|error| WebDavError::InvalidHeader(error.to_string()))?,
            );
        }
        let response = self
            .send(method, self.url_for_path(source)?, headers, None)
            .await?;
        ensure_success(&response)
    }

    pub async fn put_bytes(
        &self,
        path: &str,
        body: Vec<u8>,
        condition: WriteCondition,
    ) -> Result<(), WebDavError> {
        self.put_body(
            path,
            RequestBody::Bytes(body),
            write_condition_headers(condition)?,
        )
        .await
    }

    pub async fn put_file(
        &self,
        path: &str,
        file: File,
        length: u64,
        condition: WriteCondition,
    ) -> Result<(), WebDavError> {
        self.put_body(
            path,
            RequestBody::File { file, length },
            write_condition_headers(condition)?,
        )
        .await
    }

    async fn put_body(
        &self,
        path: &str,
        body: RequestBody,
        headers: HeaderMap,
    ) -> Result<(), WebDavError> {
        let response = self
            .send(Method::PUT, self.url_for_path(path)?, headers, Some(body))
            .await?;
        ensure_success(&response)
    }

    pub async fn get_prefix(&self, path: &str, max_bytes: u64) -> Result<Vec<u8>, WebDavError> {
        if max_bytes == 0 {
            return Ok(Vec::new());
        }
        let mut headers = HeaderMap::new();
        headers.insert(
            RANGE,
            HeaderValue::from_str(&format!("bytes=0-{}", max_bytes - 1))
                .map_err(|error| WebDavError::InvalidHeader(error.to_string()))?,
        );
        let response = self
            .send(Method::GET, self.url_for_path(path)?, headers, None)
            .await?;
        if !matches!(
            response.status(),
            StatusCode::OK | StatusCode::PARTIAL_CONTENT
        ) {
            return Err(status_error(&response));
        }
        response_prefix(response, max_bytes as usize).await
    }

    pub async fn get_to_writer(
        &self,
        path: &str,
        writer: &mut (dyn Write + Send),
        on_progress: &mut (dyn FnMut(u64) + Send),
    ) -> Result<u64, WebDavError> {
        let mut response = self
            .send(
                Method::GET,
                self.url_for_path(path)?,
                HeaderMap::new(),
                None,
            )
            .await?;
        if response.status() != StatusCode::OK {
            return Err(status_error(&response));
        }
        let mut total = 0_u64;
        while let Some(chunk) = response.chunk().await? {
            writer.write_all(&chunk)?;
            total += chunk.len() as u64;
            on_progress(total);
        }
        writer.flush()?;
        Ok(total)
    }

    async fn send(
        &self,
        mut method: Method,
        mut url: Url,
        headers: HeaderMap,
        mut body: Option<RequestBody>,
    ) -> Result<Response, WebDavError> {
        for redirect_count in 0..=MAX_REDIRECTS {
            if url.origin() != self.origin.origin() {
                return Err(WebDavError::RedirectRejected {
                    from: safe_url(&self.origin),
                    to: safe_url(&url),
                });
            }

            let mut request = self
                .http
                .request(method.clone(), url.clone())
                .headers(headers.clone())
                .basic_auth(&self.username, Some(&self.password));
            match &body {
                Some(RequestBody::Bytes(bytes)) => {
                    request = request.body(bytes.clone());
                }
                Some(RequestBody::File { file, length }) => {
                    let mut upload = file.try_clone()?;
                    upload.seek(SeekFrom::Start(0))?;
                    request = request
                        .header(CONTENT_LENGTH, *length)
                        .body(Body::from(tokio::fs::File::from_std(upload)));
                }
                None => {}
            }
            let response = request.send().await?;
            if !response.status().is_redirection() {
                return Ok(response);
            }
            if redirect_count == MAX_REDIRECTS {
                return Err(WebDavError::RedirectLimit {
                    url: safe_url(&url),
                });
            }
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| WebDavError::RedirectRejected {
                    from: safe_url(&url),
                    to: "missing Location header".to_string(),
                })?;
            let next = url
                .join(location)
                .map_err(|error| WebDavError::InvalidUrl(error.to_string()))?;
            if next.origin() != self.origin.origin()
                || !next.username().is_empty()
                || next.password().is_some()
            {
                return Err(WebDavError::RedirectRejected {
                    from: safe_url(&url),
                    to: safe_url(&next),
                });
            }
            if response.status() == StatusCode::SEE_OTHER {
                if !matches!(method, Method::GET | Method::HEAD) {
                    return Err(WebDavError::RedirectRejected {
                        from: safe_url(&url),
                        to: safe_url(&next),
                    });
                }
                method = Method::GET;
                body = None;
            } else if !matches!(
                response.status(),
                StatusCode::MOVED_PERMANENTLY
                    | StatusCode::FOUND
                    | StatusCode::TEMPORARY_REDIRECT
                    | StatusCode::PERMANENT_REDIRECT
            ) {
                return Err(WebDavError::RedirectRejected {
                    from: safe_url(&url),
                    to: safe_url(&next),
                });
            }
            url = next;
        }
        Err(WebDavError::RedirectLimit {
            url: safe_url(&url),
        })
    }
}

fn write_condition_headers(condition: WriteCondition) -> Result<HeaderMap, WebDavError> {
    let mut headers = HeaderMap::new();
    match condition {
        WriteCondition::Overwrite => {}
        WriteCondition::CreateOnly => {
            headers.insert(IF_NONE_MATCH, HeaderValue::from_static("*"));
        }
        WriteCondition::IfMatch(etag) => {
            headers.insert(
                IF_MATCH,
                HeaderValue::from_str(&etag)
                    .map_err(|error| WebDavError::InvalidHeader(error.to_string()))?,
            );
        }
    }
    Ok(headers)
}

fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || IpAddr::from_str(host).is_ok_and(|address| address.is_loopback())
}

fn method(name: &'static str) -> Result<Method, WebDavError> {
    Method::from_bytes(name.as_bytes())
        .map_err(|error| WebDavError::InvalidHeader(error.to_string()))
}

fn insert_header(
    headers: &mut HeaderMap,
    name: &'static str,
    value: &str,
) -> Result<(), WebDavError> {
    headers.insert(
        reqwest::header::HeaderName::from_static(name),
        HeaderValue::from_str(value)
            .map_err(|error| WebDavError::InvalidHeader(error.to_string()))?,
    );
    Ok(())
}

fn ensure_success(response: &Response) -> Result<(), WebDavError> {
    if response.status().is_success() {
        Ok(())
    } else {
        Err(status_error(response))
    }
}

fn status_error(response: &Response) -> WebDavError {
    let status = response.status();
    let url = safe_url(response.url());
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            WebDavError::Authentication { url, status }
        }
        StatusCode::NOT_FOUND => WebDavError::NotFound { url },
        StatusCode::CONFLICT | StatusCode::PRECONDITION_FAILED | StatusCode::LOCKED => {
            WebDavError::Conflict { url, status }
        }
        _ => WebDavError::Status { url, status },
    }
}

fn safe_url(url: &Url) -> String {
    let mut safe = url.clone();
    let _ = safe.set_username("");
    let _ = safe.set_password(None);
    safe.set_query(None);
    safe.set_fragment(None);
    safe.to_string()
}

async fn response_bytes_bounded(
    mut response: Response,
    limit: usize,
) -> Result<Vec<u8>, WebDavError> {
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if body.len().saturating_add(chunk.len()) > limit {
            return Err(WebDavError::ResponseTooLarge { limit });
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

async fn response_prefix(mut response: Response, limit: usize) -> Result<Vec<u8>, WebDavError> {
    let mut body = Vec::with_capacity(limit.min(64 * 1024));
    while body.len() < limit {
        let Some(chunk) = response.chunk().await? else {
            break;
        };
        let remaining = limit - body.len();
        body.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
        if chunk.len() > remaining {
            break;
        }
    }
    Ok(body)
}

#[derive(Default)]
struct ParsedProperties {
    display_name: Option<String>,
    is_collection: bool,
    content_length: Option<u64>,
    modified_at: Option<DateTime<Utc>>,
    created_at: Option<DateTime<Utc>>,
    etag: Option<String>,
}

#[derive(Default)]
struct ParsedPropstat {
    status: Option<String>,
    properties: ParsedProperties,
}

#[derive(Default)]
struct ParsedResponse {
    href: Option<String>,
    properties: ParsedProperties,
    has_successful_propstat: bool,
}

struct ElementFrame {
    name: String,
    text: String,
}

pub fn parse_multistatus(xml: &str) -> Result<Vec<DavResource>, WebDavError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut stack: Vec<ElementFrame> = Vec::new();
    let mut current_response: Option<ParsedResponse> = None;
    let mut current_propstat: Option<ParsedPropstat> = None;
    let mut resources = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) => {
                let name = local_name(event.local_name().as_ref())?;
                if name == "response" {
                    current_response = Some(ParsedResponse::default());
                } else if name == "propstat" && current_response.is_some() {
                    current_propstat = Some(ParsedPropstat::default());
                } else if name == "collection" {
                    if let Some(propstat) = current_propstat.as_mut() {
                        propstat.properties.is_collection = true;
                    }
                }
                stack.push(ElementFrame {
                    name,
                    text: String::new(),
                });
            }
            Ok(Event::Empty(event)) => {
                let name = local_name(event.local_name().as_ref())?;
                if name == "collection" {
                    if let Some(propstat) = current_propstat.as_mut() {
                        propstat.properties.is_collection = true;
                    }
                }
            }
            Ok(Event::Text(event)) => {
                let value = event
                    .decode()
                    .map_err(|error| WebDavError::InvalidXml(error.to_string()))?;
                if let Some(frame) = stack.last_mut() {
                    frame.text.push_str(&value);
                }
            }
            Ok(Event::CData(event)) => {
                let value = event
                    .decode()
                    .map_err(|error| WebDavError::InvalidXml(error.to_string()))?
                    .into_owned();
                if let Some(frame) = stack.last_mut() {
                    frame.text.push_str(&value);
                }
            }
            Ok(Event::GeneralRef(reference)) => {
                let decoded = reference
                    .decode()
                    .map_err(|error| WebDavError::InvalidXml(error.to_string()))?;
                let resolved = match decoded.as_ref() {
                    "amp" => "&".to_string(),
                    "lt" => "<".to_string(),
                    "gt" => ">".to_string(),
                    "apos" => "'".to_string(),
                    "quot" => "\"".to_string(),
                    _ => reference
                        .resolve_char_ref()
                        .map_err(|error| WebDavError::InvalidXml(error.to_string()))?
                        .map(|value| value.to_string())
                        .ok_or_else(|| {
                            WebDavError::InvalidXml(
                                "general entity expansion is not allowed".to_string(),
                            )
                        })?,
                };
                if let Some(frame) = stack.last_mut() {
                    frame.text.push_str(&resolved);
                }
            }
            Ok(Event::End(event)) => {
                let name = local_name(event.local_name().as_ref())?;
                if let Some(frame) = stack.last() {
                    apply_text(
                        Some(frame.name.as_str()),
                        frame.text.trim(),
                        current_response.as_mut(),
                        current_propstat.as_mut(),
                    );
                }
                if name == "propstat" {
                    if let (Some(response), Some(propstat)) =
                        (current_response.as_mut(), current_propstat.take())
                    {
                        if propstat
                            .status
                            .as_deref()
                            .is_some_and(http_status_is_success)
                        {
                            merge_properties(&mut response.properties, propstat.properties);
                            response.has_successful_propstat = true;
                        }
                    }
                } else if name == "response" {
                    if let Some(response) = current_response.take() {
                        if response.has_successful_propstat {
                            let Some(href) = response.href else {
                                stack.pop();
                                continue;
                            };
                            resources.push(DavResource {
                                href,
                                display_name: response.properties.display_name,
                                is_collection: response.properties.is_collection,
                                content_length: response.properties.content_length,
                                modified_at: response.properties.modified_at,
                                created_at: response.properties.created_at,
                                etag: response.properties.etag,
                            });
                        }
                    }
                }
                stack.pop();
            }
            Ok(Event::Eof) => break,
            Ok(Event::DocType(_)) => {
                return Err(WebDavError::InvalidXml(
                    "DTD expansion is not allowed".to_string(),
                ));
            }
            Ok(_) => {}
            Err(error) => return Err(WebDavError::InvalidXml(error.to_string())),
        }
    }

    Ok(resources)
}

fn local_name(bytes: &[u8]) -> Result<String, WebDavError> {
    std::str::from_utf8(bytes)
        .map(str::to_ascii_lowercase)
        .map_err(|error| WebDavError::InvalidXml(error.to_string()))
}

fn apply_text(
    name: Option<&str>,
    value: &str,
    response: Option<&mut ParsedResponse>,
    propstat: Option<&mut ParsedPropstat>,
) {
    match (name, propstat) {
        (Some("status"), Some(propstat)) => propstat.status = Some(value.to_string()),
        (Some("displayname"), Some(propstat)) => propstat.properties.display_name = nonempty(value),
        (Some("getcontentlength"), Some(propstat)) => {
            propstat.properties.content_length = value.parse().ok()
        }
        (Some("getlastmodified"), Some(propstat)) => {
            propstat.properties.modified_at = parse_datetime(value)
        }
        (Some("creationdate"), Some(propstat)) => {
            propstat.properties.created_at = parse_datetime(value)
        }
        (Some("getetag"), Some(propstat)) => propstat.properties.etag = nonempty(value),
        (Some("href"), None) => {
            if let Some(response) = response {
                response.href = nonempty(value);
            }
        }
        _ => {}
    }
}

fn merge_properties(target: &mut ParsedProperties, source: ParsedProperties) {
    if source.display_name.is_some() {
        target.display_name = source.display_name;
    }
    target.is_collection |= source.is_collection;
    if source.content_length.is_some() {
        target.content_length = source.content_length;
    }
    if source.modified_at.is_some() {
        target.modified_at = source.modified_at;
    }
    if source.created_at.is_some() {
        target.created_at = source.created_at;
    }
    if source.etag.is_some() {
        target.etag = source.etag;
    }
}

fn http_status_is_success(status_line: &str) -> bool {
    status_line
        .split_whitespace()
        .nth(1)
        .and_then(|status| status.parse::<u16>().ok())
        .is_some_and(|status| (200..300).contains(&status))
}

fn nonempty(value: &str) -> Option<String> {
    (!value.is_empty()).then(|| value.to_string())
}

fn parse_datetime(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc2822(value)
        .or_else(|_| DateTime::parse_from_rfc3339(value))
        .ok()
        .map(|value| value.with_timezone(&Utc))
}
