use std::sync::Arc;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfile};
use remote_core::{AuthSecrets, RemoteConnector, RemoteError, RemoteSession};

use crate::client::S3Client;

pub struct S3Session {
    client: S3Client,
    profile_id: String,
}

impl S3Session {
    pub fn new(client: S3Client, profile_id: String) -> Self {
        Self { client, profile_id }
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            client: self.client.clone(),
            profile_id: self.profile_id.clone(),
        }
    }

    pub fn client(&self) -> &S3Client {
        &self.client
    }

    pub fn _profile_id(&self) -> &str {
        &self.profile_id
    }
}

#[async_trait]
impl RemoteSession for S3Session {
    async fn ping(&self) -> Result<(), RemoteError> {
        self.client().head_bucket().await
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

pub struct S3Connector;

impl Default for S3Connector {
    fn default() -> Self {
        Self::new()
    }
}

impl S3Connector {
    pub fn new() -> Self {
        Self
    }

    fn resolve_endpoint_region_and_bucket(profile: &NetworkProfile) -> (String, String, String) {
        let host = &profile.host;
        let default_path = profile.default_path.trim_start_matches('/');

        // Try to extract bucket from defaultPath: /bucket-name/path
        let bucket_name = default_path
            .split('/')
            .next()
            .unwrap_or(default_path)
            .to_string();

        // Parse host for region/endpoint.
        let (endpoint, region) = if host.contains("amazonaws.com") {
            if let Some(rest) = host.strip_prefix("s3.") {
                if let Some(region_str) = rest.strip_suffix(".amazonaws.com") {
                    (
                        format!("https://s3.{region_str}.amazonaws.com"),
                        region_str.to_string(),
                    )
                } else {
                    (
                        "https://s3.amazonaws.com".to_string(),
                        "us-east-1".to_string(),
                    )
                }
            } else {
                (
                    "https://s3.amazonaws.com".to_string(),
                    "us-east-1".to_string(),
                )
            }
        } else {
            let endpoint = if host.starts_with("http://") || host.starts_with("https://") {
                host.to_string()
            } else {
                format!("http://{host}")
            };
            (endpoint, "auto".to_string())
        };

        (endpoint, region, bucket_name)
    }

    fn connect_blocking(
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<S3Session, RemoteError> {
        let (endpoint, region, bucket_name) = Self::resolve_endpoint_region_and_bucket(profile);

        if bucket_name.is_empty() {
            return Err(RemoteError::ConnectionFailed {
                uri: format!("s3://{}", profile.id),
                message: "no bucket name found in default path".to_string(),
            });
        }

        let (access_key, secret_key) = match profile.auth_kind {
            AuthKind::AccessKey | AuthKind::Password => {
                let access_key = profile.username.clone();
                let secret_key = secrets.password.as_deref().ok_or_else(|| {
                    RemoteError::AuthenticationFailed {
                        uri: format!("s3://{}", profile.id),
                        message: "missing secret access key".to_string(),
                    }
                })?;
                (access_key, secret_key.to_string())
            }
            AuthKind::PrivateKey => {
                return Err(RemoteError::AuthenticationFailed {
                    uri: format!("s3://{}", profile.id),
                    message: "S3 does not support private key authentication".to_string(),
                })
            }
            AuthKind::OAuth => {
                return Err(RemoteError::AuthenticationFailed {
                    uri: format!("s3://{}", profile.id),
                    message: "S3 does not support OAuth authentication".to_string(),
                })
            }
        };

        let client = S3Client::new(endpoint, region, bucket_name, access_key, secret_key);

        Ok(S3Session::new(client, profile.id.clone()))
    }
}

#[async_trait]
impl RemoteConnector for S3Connector {
    fn scheme(&self) -> &'static str {
        "s3"
    }

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let profile = profile.clone();
        let secrets = secrets.clone();
        let session =
            tokio::task::spawn_blocking(move || Self::connect_blocking(&profile, &secrets))
                .await
                .map_err(|error| RemoteError::Internal(error.to_string()))??;
        Ok(Arc::new(session))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        Ok(())
    }
}

/// Parse a URI like s3://profile-id/bucket-name/path/to/key into (profile_id, bucket, key)
pub fn parse_bucket_key(uri_path: &str) -> (String, String) {
    let path = uri_path.trim_start_matches('/');
    let mut parts = path.splitn(2, '/');
    let bucket = parts.next().unwrap_or("").to_string();
    let key = parts.next().unwrap_or("").to_string();
    (bucket, key)
}
