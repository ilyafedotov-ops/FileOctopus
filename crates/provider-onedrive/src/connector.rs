use std::sync::Arc;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfile};
use remote_core::{AuthSecrets, RemoteConnector, RemoteError, RemoteSession};
use reqwest::Client;

pub struct OneDriveSession {
    client: Client,
    access_token: String,
    profile_id: String,
}

impl OneDriveSession {
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
impl RemoteSession for OneDriveSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        self.client
            .get("https://graph.microsoft.com/v1.0/me")
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| RemoteError::ConnectionFailed {
                uri: format!("onedrive://{}", self.profile_id),
                message: e.to_string(),
            })?;
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

pub struct OneDriveConnector;

impl Default for OneDriveConnector {
    fn default() -> Self {
        Self::new()
    }
}

impl OneDriveConnector {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl RemoteConnector for OneDriveConnector {
    fn scheme(&self) -> &'static str {
        "onedrive"
    }

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        if profile.auth_kind != AuthKind::OAuth {
            return Err(RemoteError::AuthenticationFailed {
                uri: format!("onedrive://{}", profile.id),
                message: "OneDrive requires OAuth authentication".into(),
            });
        }

        let access_token =
            secrets
                .password
                .clone()
                .ok_or_else(|| RemoteError::AuthenticationFailed {
                    uri: format!("onedrive://{}", profile.id),
                    message: "missing OAuth access token".into(),
                })?;

        let session = OneDriveSession::new(access_token, profile.id.clone());
        Ok(Arc::new(session))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn onedrive_connector_returns_correct_scheme() {
        let connector = OneDriveConnector::new();
        assert_eq!(connector.scheme(), "onedrive");
    }
}
