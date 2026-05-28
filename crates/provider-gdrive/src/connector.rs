use std::sync::Arc;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfile};
use remote_core::{AuthSecrets, RemoteConnector, RemoteError, RemoteSession};
use reqwest::Client;

pub struct GDriveSession {
    client: Client,
    access_token: String,
    profile_id: String,
}

impl GDriveSession {
    pub fn new(access_token: String, profile_id: String) -> Self {
        Self {
            client: Client::new(),
            access_token,
            profile_id,
        }
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn access_token(&self) -> &str {
        &self.access_token
    }

    pub fn profile_id(&self) -> &str {
        &self.profile_id
    }
}

#[async_trait]
impl RemoteSession for GDriveSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        self.client
            .get("https://www.googleapis.com/drive/v3/about?fields=user")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| RemoteError::ConnectionFailed {
                uri: format!("gdrive://{}", self.profile_id),
                message: e.to_string(),
            })?;
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

pub struct GDriveConnector;

impl Default for GDriveConnector {
    fn default() -> Self {
        Self::new()
    }
}

impl GDriveConnector {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl RemoteConnector for GDriveConnector {
    fn scheme(&self) -> &'static str {
        "gdrive"
    }

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        if profile.auth_kind != AuthKind::OAuth {
            return Err(RemoteError::AuthenticationFailed {
                uri: format!("gdrive://{}", profile.id),
                message: "Google Drive requires OAuth authentication".into(),
            });
        }

        let access_token =
            secrets
                .password
                .clone()
                .ok_or_else(|| RemoteError::AuthenticationFailed {
                    uri: format!("gdrive://{}", profile.id),
                    message: "missing OAuth access token".into(),
                })?;

        let session = GDriveSession::new(access_token, profile.id.clone());
        Ok(Arc::new(session))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_profile(auth_kind: AuthKind) -> NetworkProfile {
        NetworkProfile {
            id: "test-profile".to_string(),
            label: "Test GDrive".to_string(),
            scheme: "gdrive".to_string(),
            host: "drive.google.com".to_string(),
            port: 0,
            username: String::new(),
            auth_kind,
            private_key_path: None,
            default_path: "/".to_string(),
            host_key_fingerprint: None,
            sort_order: 0,
            last_connected_at: None,
            last_error: None,
            has_stored_secret: false,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn gdrive_connector_returns_correct_scheme() {
        let connector = GDriveConnector::new();
        assert_eq!(connector.scheme(), "gdrive");
    }

    #[test]
    fn gdrive_connector_requires_oauth_auth_kind() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let connector = GDriveConnector::new();
        let profile = make_profile(AuthKind::Password);
        let secrets = AuthSecrets {
            password: Some("fake-token".into()),
            passphrase: None,
        };

        let result = rt.block_on(connector.connect(&profile, &secrets));
        assert!(result.is_err());
    }
}
