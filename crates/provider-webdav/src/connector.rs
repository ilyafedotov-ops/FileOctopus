use std::net::IpAddr;
use std::str::FromStr;
use std::sync::Arc;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfile};
use remote_core::{AuthSecrets, RemoteConnector, RemoteError, RemoteSession};
use reqwest::Url;

use crate::client::{DavDepth, WebDavClient, WebDavError};

pub struct WebDavSession {
    client: WebDavClient,
    profile_id: String,
    ping_path: String,
}

impl WebDavSession {
    pub fn new(client: WebDavClient, profile_id: String, ping_path: String) -> Self {
        Self {
            client,
            profile_id,
            ping_path,
        }
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            client: self.client.clone(),
            profile_id: self.profile_id.clone(),
            ping_path: self.ping_path.clone(),
        }
    }

    pub fn client(&self) -> &WebDavClient {
        &self.client
    }
}

#[async_trait]
impl RemoteSession for WebDavSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        self.client
            .propfind(&self.ping_path, DavDepth::Zero)
            .await
            .map(|_| ())
            .map_err(|error| remote_error(&self.profile_id, error))
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

pub struct WebDavConnector {
    allow_http_loopback: bool,
}

impl Default for WebDavConnector {
    fn default() -> Self {
        Self::new()
    }
}

impl WebDavConnector {
    pub fn new() -> Self {
        Self {
            allow_http_loopback: false,
        }
    }

    #[doc(hidden)]
    pub fn with_http_loopback_for_tests() -> Self {
        Self {
            allow_http_loopback: true,
        }
    }

    pub fn origin_for_profile(&self, profile: &NetworkProfile) -> Result<Url, RemoteError> {
        let host = normalized_host(&profile.host).ok_or_else(|| RemoteError::ConnectionFailed {
            uri: format!("webdav://{}", profile.id),
            message: "WebDAV host must be a hostname or IP address without a URL scheme or path"
                .to_string(),
        })?;
        let loopback = is_loopback_host(&host);
        let scheme = if self.allow_http_loopback && loopback {
            "http"
        } else {
            "https"
        };
        let authority_host = if IpAddr::from_str(&host).is_ok_and(|address| address.is_ipv6()) {
            format!("[{host}]")
        } else {
            host
        };
        let mut origin = Url::parse(&format!("{scheme}://{authority_host}")).map_err(|error| {
            RemoteError::ConnectionFailed {
                uri: format!("webdav://{}", profile.id),
                message: error.to_string(),
            }
        })?;
        origin
            .set_port(Some(profile.port))
            .map_err(|_| RemoteError::ConnectionFailed {
                uri: format!("webdav://{}", profile.id),
                message: "invalid WebDAV port".to_string(),
            })?;
        Ok(origin)
    }

    async fn create_session(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<WebDavSession, RemoteError> {
        if profile.scheme != "webdav" {
            return Err(RemoteError::UnsupportedScheme {
                scheme: profile.scheme.clone(),
            });
        }
        if profile.auth_kind != AuthKind::Password {
            return Err(RemoteError::AuthenticationFailed {
                uri: format!("webdav://{}", profile.id),
                message: "WebDAV supports password authentication only".to_string(),
            });
        }
        let password =
            secrets
                .password
                .clone()
                .ok_or_else(|| RemoteError::AuthenticationFailed {
                    uri: format!("webdav://{}", profile.id),
                    message: "missing WebDAV password".to_string(),
                })?;
        let origin = self.origin_for_profile(profile)?;
        if origin.scheme() != "https" && !(self.allow_http_loopback && is_loopback_url(&origin)) {
            return Err(RemoteError::ConnectionFailed {
                uri: format!("webdav://{}", profile.id),
                message: "WebDAV requires HTTPS".to_string(),
            });
        }
        let client = if origin.scheme() == "http" {
            WebDavClient::with_http_loopback_for_tests(origin, profile.username.clone(), password)
        } else {
            WebDavClient::new(origin, profile.username.clone(), password)
        }
        .map_err(|error| remote_error(&profile.id, error))?;
        client
            .propfind(&profile.default_path, DavDepth::Zero)
            .await
            .map_err(|error| remote_error(&profile.id, error))?;
        Ok(WebDavSession::new(
            client,
            profile.id.clone(),
            profile.default_path.clone(),
        ))
    }
}

#[async_trait]
impl RemoteConnector for WebDavConnector {
    fn scheme(&self) -> &'static str {
        "webdav"
    }

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        self.create_session(profile, secrets)
            .await
            .map(|session| Arc::new(session) as Arc<dyn RemoteSession>)
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        Ok(())
    }
}

fn normalized_host(host: &str) -> Option<String> {
    let trimmed = host.trim();
    if trimmed.is_empty()
        || trimmed != host
        || trimmed.contains("//")
        || trimmed.contains('/')
        || trimmed.contains('@')
        || trimmed.contains('?')
        || trimmed.contains('#')
        || trimmed.chars().any(char::is_whitespace)
    {
        return None;
    }
    let without_brackets = trimmed
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(trimmed);
    if IpAddr::from_str(without_brackets).is_err() && without_brackets.contains(':') {
        return None;
    }
    Some(without_brackets.to_string())
}

fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || IpAddr::from_str(host).is_ok_and(|address| address.is_loopback())
}

fn is_loopback_url(url: &Url) -> bool {
    url.host_str().is_some_and(is_loopback_host)
}

fn remote_error(profile_id: &str, error: WebDavError) -> RemoteError {
    match error {
        WebDavError::Authentication { .. } => RemoteError::AuthenticationFailed {
            uri: format!("webdav://{profile_id}"),
            message: "server rejected the WebDAV credentials".to_string(),
        },
        other => RemoteError::ConnectionFailed {
            uri: format!("webdav://{profile_id}"),
            message: other.to_string(),
        },
    }
}
