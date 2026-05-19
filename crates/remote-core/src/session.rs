use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use config::{NetworkProfile, NetworkProfileRepository};
use platform::SecretStore;
use tokio::sync::RwLock;

use crate::error::RemoteError;
use crate::secrets::AuthSecrets;

const SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Error { message: String },
}

#[allow(dead_code)]
pub struct RemoteSessionHandle {
    pub profile_id: String,
    pub connected_at: Instant,
    pub last_used: Instant,
    inner: Arc<dyn RemoteSession>,
}

#[async_trait]
pub trait RemoteSession: Send + Sync {
    async fn ping(&self) -> Result<(), RemoteError>;

    fn as_any(&self) -> &dyn std::any::Any;
}

#[async_trait]
pub trait RemoteConnector: Send + Sync {
    fn scheme(&self) -> &'static str;

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError>;

    async fn disconnect(&self, session: Arc<dyn RemoteSession>) -> Result<(), RemoteError>;
}

pub struct RemoteConnectorRegistry {
    connectors: HashMap<String, Arc<dyn RemoteConnector>>,
}

impl RemoteConnectorRegistry {
    pub fn new() -> Self {
        Self {
            connectors: HashMap::new(),
        }
    }

    pub fn register(&mut self, connector: Arc<dyn RemoteConnector>) {
        self.connectors
            .insert(connector.scheme().to_string(), connector);
    }

    pub fn get(&self, scheme: &str) -> Option<Arc<dyn RemoteConnector>> {
        self.connectors.get(scheme).cloned()
    }
}

impl Default for RemoteConnectorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ConnectionSessionManager {
    profiles: NetworkProfileRepository,
    secrets: SecretStore,
    connectors: Arc<RwLock<RemoteConnectorRegistry>>,
    sessions: RwLock<HashMap<String, RemoteSessionHandle>>,
    statuses: RwLock<HashMap<String, ConnectionStatus>>,
}

impl ConnectionSessionManager {
    pub fn new(
        profiles: NetworkProfileRepository,
        secrets: SecretStore,
        connectors: Arc<RwLock<RemoteConnectorRegistry>>,
    ) -> Self {
        Self {
            profiles,
            secrets,
            connectors,
            sessions: RwLock::new(HashMap::new()),
            statuses: RwLock::new(HashMap::new()),
        }
    }

    pub fn profiles(&self) -> &NetworkProfileRepository {
        &self.profiles
    }

    pub fn secrets(&self) -> &SecretStore {
        &self.secrets
    }

    pub async fn connection_status(&self, profile_id: &str) -> ConnectionStatus {
        self.statuses
            .read()
            .await
            .get(profile_id)
            .cloned()
            .unwrap_or(ConnectionStatus::Disconnected)
    }

    pub async fn all_connection_statuses(&self) -> HashMap<String, ConnectionStatus> {
        self.statuses.read().await.clone()
    }

    pub async fn connect(&self, profile_id: &str) -> Result<(), RemoteError> {
        let profile = self.profiles.get(profile_id)?;
        let connector = self
            .connectors
            .read()
            .await
            .get(&profile.scheme)
            .ok_or_else(|| RemoteError::UnsupportedScheme {
                scheme: profile.scheme.clone(),
            })?;
        let secrets = match AuthSecrets::load(&self.secrets, &profile) {
            Ok(secrets) => secrets,
            Err(platform::SecretStoreError::NotFound) => {
                let message = match profile.auth_kind {
                    config::AuthKind::Password => crate::MISSING_STORED_PASSWORD.to_string(),
                    config::AuthKind::PrivateKey => {
                        "Private key credentials are unavailable.".to_string()
                    }
                };
                self.mark_error(profile_id, &message).await;
                return Err(RemoteError::AuthenticationFailed { message });
            }
            Err(error) => {
                let message = error.to_string();
                self.mark_error(profile_id, &message).await;
                return Err(error.into());
            }
        };

        match connector.connect(&profile, &secrets).await {
            Ok(session) => {
                let now = Instant::now();
                self.sessions.write().await.insert(
                    profile_id.to_string(),
                    RemoteSessionHandle {
                        profile_id: profile_id.to_string(),
                        connected_at: now,
                        last_used: now,
                        inner: session,
                    },
                );
                self.statuses
                    .write()
                    .await
                    .insert(profile_id.to_string(), ConnectionStatus::Connected);
                let _ = self.profiles.set_connection_state(profile_id, true, None);
                Ok(())
            }
            Err(error) => {
                self.mark_error(profile_id, &error.to_string()).await;
                Err(error)
            }
        }
    }

    pub async fn disconnect(&self, profile_id: &str) -> Result<(), RemoteError> {
        let handle = self.sessions.write().await.remove(profile_id);
        if let Some(handle) = handle {
            let profile = self.profiles.get(profile_id)?;
            if let Some(connector) = self.connectors.read().await.get(&profile.scheme) {
                let _ = connector.disconnect(handle.inner).await;
            }
        }
        self.statuses
            .write()
            .await
            .insert(profile_id.to_string(), ConnectionStatus::Disconnected);
        Ok(())
    }

    pub async fn session_for_profile(
        &self,
        profile_id: &str,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        {
            let sessions = self.sessions.read().await;
            if let Some(handle) = sessions.get(profile_id) {
                if handle.last_used.elapsed() < SESSION_IDLE_TIMEOUT {
                    return Ok(handle.inner.clone());
                }
            }
        }

        self.connect(profile_id).await?;
        self.sessions
            .read()
            .await
            .get(profile_id)
            .map(|handle| handle.inner.clone())
            .ok_or_else(|| RemoteError::NotConnected {
                profile_id: profile_id.to_string(),
            })
    }

    pub async fn touch_session(&self, profile_id: &str) {
        if let Some(handle) = self.sessions.write().await.get_mut(profile_id) {
            handle.last_used = Instant::now();
        }
    }

    pub async fn mark_error(&self, profile_id: &str, message: &str) {
        self.statuses.write().await.insert(
            profile_id.to_string(),
            ConnectionStatus::Error {
                message: message.to_string(),
            },
        );
        let _ = self
            .profiles
            .set_connection_state(profile_id, false, Some(message));
        let _ = self.disconnect(profile_id).await;
    }
}
