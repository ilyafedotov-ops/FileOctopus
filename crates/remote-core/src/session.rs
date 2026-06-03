use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use config::{NetworkProfile, NetworkProfileRepository};
use platform::SecretStore;
use tokio::sync::{broadcast, RwLock};

use crate::error::RemoteError;
use crate::secrets::AuthSecrets;

const SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Error { message: String },
}

#[derive(Debug, Clone)]
pub struct NetworkStatusEvent {
    pub profile_id: String,
    pub status: ConnectionStatus,
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

    fn observed_host_key_fingerprint(&self) -> Option<&str> {
        None
    }

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
    connect_locks: RwLock<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
    status_tx: broadcast::Sender<NetworkStatusEvent>,
}

impl ConnectionSessionManager {
    pub fn new(
        profiles: NetworkProfileRepository,
        secrets: SecretStore,
        connectors: Arc<RwLock<RemoteConnectorRegistry>>,
    ) -> Self {
        let (status_tx, _) = broadcast::channel(64);
        Self {
            profiles,
            secrets,
            connectors,
            sessions: RwLock::new(HashMap::new()),
            statuses: RwLock::new(HashMap::new()),
            connect_locks: RwLock::new(HashMap::new()),
            status_tx,
        }
    }

    pub fn subscribe_status(&self) -> broadcast::Receiver<NetworkStatusEvent> {
        self.status_tx.subscribe()
    }

    fn publish_status(&self, profile_id: &str, status: ConnectionStatus) {
        let _ = self.status_tx.send(NetworkStatusEvent {
            profile_id: profile_id.to_string(),
            status,
        });
    }

    async fn connect_lock(&self, profile_id: &str) -> Arc<tokio::sync::Mutex<()>> {
        {
            let locks = self.connect_locks.read().await;
            if let Some(lock) = locks.get(profile_id) {
                return lock.clone();
            }
        }
        let mut locks = self.connect_locks.write().await;
        locks
            .entry(profile_id.to_string())
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
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

    pub async fn observed_host_key_fingerprint(&self, profile_id: &str) -> Option<String> {
        self.sessions
            .read()
            .await
            .get(profile_id)
            .and_then(|handle| {
                handle
                    .inner
                    .observed_host_key_fingerprint()
                    .map(str::to_string)
            })
    }

    pub async fn connect(&self, profile_id: &str) -> Result<(), RemoteError> {
        if self.session_is_alive(profile_id).await {
            return Ok(());
        }
        let lock = self.connect_lock(profile_id).await;
        let _guard = lock.lock().await;
        if self.session_is_alive(profile_id).await {
            return Ok(());
        }
        self.force_connect(profile_id).await
    }

    async fn session_is_alive(&self, profile_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        let Some(handle) = sessions.get(profile_id) else {
            return false;
        };
        if handle.last_used.elapsed() >= SESSION_IDLE_TIMEOUT {
            return false;
        }
        handle.inner.ping().await.is_ok()
    }

    pub async fn force_connect(&self, profile_id: &str) -> Result<(), RemoteError> {
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
                    config::AuthKind::AccessKey => {
                        "Access key credentials are unavailable.".to_string()
                    }
                    config::AuthKind::OAuth => "OAuth token is unavailable.".to_string(),
                };
                self.mark_error(profile_id, &message).await;
                return Err(RemoteError::AuthenticationFailed {
                    uri: format!("sftp://{profile_id}"),
                    message,
                });
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
                self.publish_status(profile_id, ConnectionStatus::Connected);
                let _ = self.profiles.set_connection_state(profile_id, true, None);
                if profile.auth_kind == config::AuthKind::Password {
                    let _ = self.profiles.set_has_stored_secret(profile_id, true);
                }
                Ok(())
            }
            Err(error) => {
                self.mark_error(profile_id, &error.to_string()).await;
                Err(error)
            }
        }
    }

    pub async fn disconnect(&self, profile_id: &str) -> Result<(), RemoteError> {
        self.drop_session_handle(profile_id).await;
        self.statuses
            .write()
            .await
            .insert(profile_id.to_string(), ConnectionStatus::Disconnected);
        self.publish_status(profile_id, ConnectionStatus::Disconnected);
        Ok(())
    }

    /// Removes the session handle and asks the connector to tear it down
    /// without touching the status map or broadcast channel. Used when a caller
    /// (e.g. `mark_error`) needs to clean up the live connection while keeping
    /// a non-Disconnected status visible to subscribers. A missing profile row
    /// is tolerated so a race against profile deletion does not orphan the
    /// session entry.
    async fn drop_session_handle(&self, profile_id: &str) {
        let handle = self.sessions.write().await.remove(profile_id);
        if let Some(handle) = handle {
            if let Ok(profile) = self.profiles.get(profile_id) {
                if let Some(connector) = self.connectors.read().await.get(&profile.scheme) {
                    let _ = connector.disconnect(handle.inner).await;
                }
            }
        }
    }

    pub async fn reap_idle_sessions(&self, threshold: Duration) {
        let stale: Vec<String> = {
            let sessions = self.sessions.read().await;
            sessions
                .iter()
                .filter(|(_, handle)| handle.last_used.elapsed() >= threshold)
                .map(|(id, _)| id.clone())
                .collect()
        };

        for profile_id in stale {
            let _ = self.disconnect(&profile_id).await;
        }
    }

    pub async fn session_for_profile(
        &self,
        profile_id: &str,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let lock = self.connect_lock(profile_id).await;
        let _guard = lock.lock().await;

        let cached: Option<Arc<dyn RemoteSession>> = {
            let sessions = self.sessions.read().await;
            sessions
                .get(profile_id)
                .filter(|handle| handle.last_used.elapsed() < SESSION_IDLE_TIMEOUT)
                .map(|handle| handle.inner.clone())
        };

        if let Some(session) = cached {
            if session.ping().await.is_ok() {
                return Ok(session);
            }
            let _ = self.disconnect(profile_id).await;
        }

        self.force_connect(profile_id).await?;
        self.sessions
            .read()
            .await
            .get(profile_id)
            .map(|handle| handle.inner.clone())
            .ok_or_else(|| RemoteError::NotConnected {
                uri: format!("sftp://{profile_id}"),
            })
    }

    /// Fetch the live session for `profile_id` and project it to a typed
    /// session handle. Centralises the `session_for_profile` + `downcast_ref`
    /// boilerplate (and its "invalid session handle" error) that every remote
    /// VFS provider would otherwise repeat. `scheme` is only used to label the
    /// downcast-failure error; `project` borrows the concrete session and
    /// returns whatever owned handle the caller needs.
    pub async fn typed_session_for<T, R>(
        &self,
        profile_id: &str,
        scheme: &str,
        project: impl FnOnce(&T) -> R,
    ) -> Result<R, RemoteError>
    where
        T: 'static,
    {
        let session = self.session_for_profile(profile_id).await?;
        let typed = session
            .as_any()
            .downcast_ref::<T>()
            .ok_or_else(|| RemoteError::Internal(format!("invalid {scheme} session handle")))?;
        Ok(project(typed))
    }

    pub async fn touch_session(&self, profile_id: &str) {
        if let Some(handle) = self.sessions.write().await.get_mut(profile_id) {
            handle.last_used = Instant::now();
        }
    }

    pub async fn mark_error(&self, profile_id: &str, message: &str) {
        // Tear the live handle down silently so the Error status is the final
        // event observed by subscribers — otherwise the trailing Disconnected
        // emit would overwrite the error message in the frontend status map.
        self.drop_session_handle(profile_id).await;
        let status = ConnectionStatus::Error {
            message: message.to_string(),
        };
        self.statuses
            .write()
            .await
            .insert(profile_id.to_string(), status.clone());
        self.publish_status(profile_id, status);
        let _ = self
            .profiles
            .set_connection_state(profile_id, false, Some(message));
    }
}

const IDLE_REAPER_TICK: Duration = Duration::from_secs(60);

pub async fn run_idle_reaper(manager: Arc<ConnectionSessionManager>) {
    let mut interval = tokio::time::interval(IDLE_REAPER_TICK);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        manager.reap_idle_sessions(SESSION_IDLE_TIMEOUT).await;
    }
}
