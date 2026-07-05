use std::collections::BTreeMap;

use chrono::Utc;
use hmac::{Hmac, Mac};
use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use quick_xml::de::from_str;
use reqwest::{header::HeaderMap, Client, Method, StatusCode};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use remote_core::RemoteError;
use vfs::VfsError;

const S3_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone)]
pub struct S3Client {
    http: Client,
    endpoint: String,
    region: String,
    bucket: String,
    access_key: String,
    secret_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S3Object {
    pub key: String,
    pub size: u64,
    pub last_modified: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S3CommonPrefix {
    pub prefix: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S3ListPage {
    pub contents: Vec<S3Object>,
    pub common_prefixes: Vec<S3CommonPrefix>,
    pub is_truncated: bool,
    pub next_continuation_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S3HeadObject {
    pub content_length: Option<u64>,
    pub content_type: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct ListBucketXml {
    #[serde(default, rename = "Contents")]
    contents: Vec<ObjectXml>,
    #[serde(default, rename = "CommonPrefixes")]
    common_prefixes: Vec<CommonPrefixXml>,
    #[serde(default, rename = "IsTruncated")]
    is_truncated: bool,
    #[serde(rename = "NextContinuationToken")]
    next_continuation_token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct ObjectXml {
    key: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    last_modified: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct CommonPrefixXml {
    prefix: String,
}

impl From<ListBucketXml> for S3ListPage {
    fn from(value: ListBucketXml) -> Self {
        Self {
            contents: value
                .contents
                .into_iter()
                .map(|object| S3Object {
                    key: object.key,
                    size: object.size,
                    last_modified: object.last_modified,
                })
                .collect(),
            common_prefixes: value
                .common_prefixes
                .into_iter()
                .map(|prefix| S3CommonPrefix {
                    prefix: prefix.prefix,
                })
                .collect(),
            is_truncated: value.is_truncated,
            next_continuation_token: value.next_continuation_token,
        }
    }
}

impl S3Client {
    pub fn new(
        endpoint: String,
        region: String,
        bucket: String,
        access_key: String,
        secret_key: String,
    ) -> Self {
        Self {
            http: Client::new(),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            region,
            bucket,
            access_key,
            secret_key,
        }
    }

    pub fn bucket_name(&self) -> &str {
        &self.bucket
    }

    pub async fn head_bucket(&self) -> Result<(), RemoteError> {
        let response = self
            .send(Method::HEAD, "", &[], BTreeMap::new(), Vec::new())
            .await
            .map_err(|message| RemoteError::ConnectionFailed {
                uri: format!("s3://{}", self.bucket),
                message,
            })?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(RemoteError::ConnectionFailed {
                uri: format!("s3://{}", self.bucket),
                message: format!("S3 head bucket failed: {}", response.status()),
            })
        }
    }

    pub async fn list_page(
        &self,
        prefix: String,
        delimiter: Option<String>,
        continuation_token: Option<String>,
        _start_after: Option<String>,
        max_keys: Option<usize>,
    ) -> Result<S3ListPage, VfsError> {
        let mut query = vec![("list-type", "2".to_string()), ("prefix", prefix)];
        if let Some(delimiter) = delimiter {
            query.push(("delimiter", delimiter));
        }
        if let Some(token) = continuation_token {
            query.push(("continuation-token", token));
        }
        if let Some(max_keys) = max_keys {
            query.push(("max-keys", max_keys.to_string()));
        }

        let response = self
            .send(Method::GET, "", &query, BTreeMap::new(), Vec::new())
            .await
            .map_err(|e| VfsError::internal(&format!("s3 list failed: {e}")))?;
        let status = response.status();
        let body = response
            .bytes()
            .await
            .map_err(|e| VfsError::internal(&format!("s3 list read failed: {e}")))?;
        if !status.is_success() {
            return Err(VfsError::internal(&format!("s3 list failed: {status}")));
        }
        parse_list_bucket_response(
            std::str::from_utf8(&body).map_err(|e| {
                VfsError::internal(&format!("s3 list response was not UTF-8 XML: {e}"))
            })?,
        )
        .map_err(|e| VfsError::internal(&format!("s3 list XML parse failed: {e}")))
    }

    pub async fn head_object(&self, key: &str) -> Result<S3HeadObject, VfsError> {
        let response = self
            .send(Method::HEAD, key, &[], BTreeMap::new(), Vec::new())
            .await
            .map_err(|e| VfsError::internal(&format!("s3 head_object failed: {e}")))?;
        if response.status() == StatusCode::NOT_FOUND {
            return Err(VfsError::internal(&format!(
                "s3 head_object not found: {key}"
            )));
        }
        if !response.status().is_success() {
            return Err(VfsError::internal(&format!(
                "s3 head_object failed: {}",
                response.status()
            )));
        }
        let headers = response.headers();
        Ok(S3HeadObject {
            content_length: parse_content_length(headers),
            content_type: header_string(headers, "content-type"),
            last_modified: header_string(headers, "last-modified"),
        })
    }

    pub async fn put_object(&self, key: &str, bytes: &[u8]) -> Result<(), VfsError> {
        let response = self
            .send(Method::PUT, key, &[], BTreeMap::new(), bytes.to_vec())
            .await
            .map_err(|e| VfsError::internal(&format!("s3 put_object failed: {e}")))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(VfsError::internal(&format!(
                "s3 put_object failed: {}",
                response.status()
            )))
        }
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), VfsError> {
        let response = self
            .send(Method::DELETE, key, &[], BTreeMap::new(), Vec::new())
            .await
            .map_err(|e| VfsError::internal(&format!("s3 delete_object failed: {e}")))?;
        if response.status().is_success() || response.status() == StatusCode::NO_CONTENT {
            Ok(())
        } else {
            Err(VfsError::internal(&format!(
                "s3 delete_object failed: {}",
                response.status()
            )))
        }
    }

    pub async fn copy_object(&self, from_key: &str, to_key: &str) -> Result<(), VfsError> {
        let mut headers = BTreeMap::new();
        headers.insert(
            "x-amz-copy-source".to_string(),
            format!("/{}/{}", self.bucket, encode_key_path(from_key)),
        );
        let response = self
            .send(Method::PUT, to_key, &[], headers, Vec::new())
            .await
            .map_err(|e| VfsError::internal(&format!("s3 copy_object failed: {e}")))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(VfsError::internal(&format!(
                "s3 copy_object failed: {}",
                response.status()
            )))
        }
    }

    pub async fn get_object_range(
        &self,
        key: &str,
        start: u64,
        end: Option<u64>,
    ) -> Result<Vec<u8>, VfsError> {
        let mut headers = BTreeMap::new();
        let range = match end {
            Some(end) => format!("bytes={start}-{end}"),
            None => format!("bytes={start}-"),
        };
        headers.insert("range".to_string(), range);
        let response = self
            .send(Method::GET, key, &[], headers, Vec::new())
            .await
            .map_err(|e| VfsError::internal(&format!("s3 get_object_range failed: {e}")))?;
        if !response.status().is_success() {
            return Err(VfsError::internal(&format!(
                "s3 get_object_range failed: {}",
                response.status()
            )));
        }
        response
            .bytes()
            .await
            .map(|bytes| bytes.to_vec())
            .map_err(|e| VfsError::internal(&format!("s3 get_object_range read failed: {e}")))
    }

    async fn send(
        &self,
        method: Method,
        key: &str,
        query: &[(&str, String)],
        extra_headers: BTreeMap<String, String>,
        body: Vec<u8>,
    ) -> Result<reqwest::Response, String> {
        let path = if key.is_empty() {
            format!("/{}", encode_key_path(&self.bucket))
        } else {
            format!(
                "/{}/{}",
                encode_key_path(&self.bucket),
                encode_key_path(key)
            )
        };
        let url = format!("{}{}{}", self.endpoint, path, canonical_query_string(query));
        let payload_hash = hex::encode(Sha256::digest(&body));
        let signed = sign_v4(SignRequest {
            method: &method,
            url: &url,
            query,
            extra_headers: &extra_headers,
            payload_hash: &payload_hash,
            region: &self.region,
            access_key: &self.access_key,
            secret_key: &self.secret_key,
        })?;

        let mut request = self.http.request(method, &url).body(body);
        for (name, value) in signed {
            request = request.header(name, value);
        }
        request.send().await.map_err(|e| e.to_string())
    }
}

pub fn parse_list_bucket_response(xml: &str) -> Result<S3ListPage, quick_xml::DeError> {
    from_str::<ListBucketXml>(xml).map(Into::into)
}

fn parse_content_length(headers: &HeaderMap) -> Option<u64> {
    header_string(headers, "content-length").and_then(|value| value.parse().ok())
}

fn header_string(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

struct SignRequest<'a> {
    method: &'a Method,
    url: &'a str,
    query: &'a [(&'a str, String)],
    extra_headers: &'a BTreeMap<String, String>,
    payload_hash: &'a str,
    region: &'a str,
    access_key: &'a str,
    secret_key: &'a str,
}

fn sign_v4(request: SignRequest<'_>) -> Result<BTreeMap<String, String>, String> {
    let parsed = reqwest::Url::parse(request.url).map_err(|e| e.to_string())?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "S3 endpoint is missing host".to_string())?;
    let host = match parsed.port() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_string(),
    };
    let now = Utc::now();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date = now.format("%Y%m%d").to_string();

    let mut headers = BTreeMap::new();
    headers.insert("host".to_string(), host);
    headers.insert(
        "x-amz-content-sha256".to_string(),
        request.payload_hash.to_string(),
    );
    headers.insert("x-amz-date".to_string(), amz_date.clone());
    for (name, value) in request.extra_headers {
        headers.insert(name.to_ascii_lowercase(), value.trim().to_string());
    }

    let canonical_headers = headers
        .iter()
        .map(|(name, value)| format!("{name}:{}\n", normalize_header_value(value)))
        .collect::<String>();
    let signed_headers = headers.keys().cloned().collect::<Vec<_>>().join(";");
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        request.method.as_str(),
        parsed.path(),
        canonical_query_string(request.query).trim_start_matches('?'),
        canonical_headers,
        signed_headers,
        request.payload_hash
    );
    let scope = format!("{date}/{}/s3/aws4_request", request.region);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
        hex::encode(Sha256::digest(canonical_request.as_bytes()))
    );
    let signing_key = signing_key(request.secret_key, &date, request.region)?;
    let signature = hmac_hex(&signing_key, string_to_sign.as_bytes())?;
    let auth = format!(
        "AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={signed_headers}, Signature={signature}",
        request.access_key
    );

    let mut result = headers;
    result.insert("authorization".to_string(), auth);
    Ok(result)
}

fn signing_key(secret_key: &str, date: &str, region: &str) -> Result<Vec<u8>, String> {
    let k_date = hmac_bytes(format!("AWS4{secret_key}").as_bytes(), date.as_bytes())?;
    let k_region = hmac_bytes(&k_date, region.as_bytes())?;
    let k_service = hmac_bytes(&k_region, b"s3")?;
    hmac_bytes(&k_service, b"aws4_request")
}

fn hmac_bytes(key: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut mac = HmacSha256::new_from_slice(key).map_err(|e| e.to_string())?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn hmac_hex(key: &[u8], data: &[u8]) -> Result<String, String> {
    hmac_bytes(key, data).map(hex::encode)
}

fn canonical_query_string(query: &[(&str, String)]) -> String {
    if query.is_empty() {
        return String::new();
    }
    let mut pairs = query
        .iter()
        .map(|(key, value)| (encode_query_component(key), encode_query_component(value)))
        .collect::<Vec<_>>();
    pairs.sort();
    format!(
        "?{}",
        pairs
            .into_iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>()
            .join("&")
    )
}

fn encode_query_component(value: &str) -> String {
    utf8_percent_encode(value, S3_ENCODE_SET)
        .to_string()
        .replace('+', "%20")
}

fn encode_key_path(value: &str) -> String {
    value
        .split('/')
        .map(|segment| utf8_percent_encode(segment, S3_ENCODE_SET).to_string())
        .collect::<Vec<_>>()
        .join("/")
}

fn normalize_header_value(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_list_bucket_v2_response_with_files_prefixes_and_pagination() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>bucket</Name>
  <Prefix>docs/</Prefix>
  <KeyCount>2</KeyCount>
  <MaxKeys>2</MaxKeys>
  <IsTruncated>true</IsTruncated>
  <Contents>
    <Key>docs/file.txt</Key>
    <LastModified>2026-07-05T10:00:00.000Z</LastModified>
    <ETag>&quot;abc&quot;</ETag>
    <Size>42</Size>
  </Contents>
  <CommonPrefixes><Prefix>docs/nested/</Prefix></CommonPrefixes>
  <NextContinuationToken>token-2</NextContinuationToken>
</ListBucketResult>"#;

        let page = parse_list_bucket_response(xml).expect("valid list bucket XML");

        assert_eq!(page.contents.len(), 1);
        assert_eq!(page.contents[0].key, "docs/file.txt");
        assert_eq!(page.contents[0].size, 42);
        assert_eq!(page.common_prefixes[0].prefix, "docs/nested/");
        assert!(page.is_truncated);
        assert_eq!(page.next_continuation_token.as_deref(), Some("token-2"));
    }

    #[test]
    fn canonical_query_sorts_and_escapes_values_for_sigv4() {
        let query = canonical_query_string(&[
            ("prefix", "docs/space name".to_string()),
            ("list-type", "2".to_string()),
        ]);

        assert_eq!(query, "?list-type=2&prefix=docs/space%20name");
    }

    #[test]
    fn key_path_encoding_preserves_separators() {
        assert_eq!(
            encode_key_path("docs/space name#.txt"),
            "docs/space%20name%23.txt"
        );
    }
}
