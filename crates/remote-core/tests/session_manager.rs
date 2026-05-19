use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfileRepository, NewNetworkProfile};
use platform::SecretStore;
use remote_core::{
    AuthSecrets, ConnectionSessionManager, ConnectionStatus, RemoteConnector,
    RemoteConnectorRegistry, RemoteError, RemoteSession,
};
use tempfile::TempDir;
use tokio::sync::RwLock;

#[derive(Default)]
struct StubSession {
    ping_should_fail: Arc<Mutex<bool>>,
}

#[async_trait]
impl RemoteSession for StubSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        if *self.ping_should_fail.lock().unwrap() {
            return Err(RemoteError::ConnectionFailed {
                uri: "sftp://test".into(),
                message: "stub fault".into(),
            });
        }
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[derive(Default)]
struct StubConnector {
    connects: AtomicUsize,
    disconnects: AtomicUsize,
    next_failure: Mutex<Vec<Arc<Mutex<bool>>>>,
}

impl StubConnector {
    fn kill_next_session_after_open(&self) -> Arc<Mutex<bool>> {
        let flag = Arc::new(Mutex::new(false));
        self.next_failure.lock().unwrap().push(flag.clone());
        flag
    }
}

#[async_trait]
impl RemoteConnector for StubConnector {
    fn scheme(&self) -> &'static str {
        "sftp"
    }

    async fn connect(
        &self,
        _profile: &config::NetworkProfile,
        _secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        self.connects.fetch_add(1, Ordering::SeqCst);
        let flag = self
            .next_failure
            .lock()
            .unwrap()
            .pop()
            .unwrap_or_else(|| Arc::new(Mutex::new(false)));
        Ok(Arc::new(StubSession {
            ping_should_fail: flag,
        }))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        self.disconnects.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

struct Fixture {
    _temp: TempDir,
    profiles: NetworkProfileRepository,
    secrets: SecretStore,
    connector: Arc<StubConnector>,
    registry: Arc<RwLock<RemoteConnectorRegistry>>,
}

impl Fixture {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let profiles = NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
        let secrets = SecretStore::new();
        let connector = Arc::new(StubConnector::default());
        let mut registry = RemoteConnectorRegistry::new();
        registry.register(connector.clone());
        Self {
            _temp: temp,
            profiles,
            secrets,
            connector,
            registry: Arc::new(RwLock::new(registry)),
        }
    }

    fn add_profile(&self) -> String {
        let created = self
            .profiles
            .add(NewNetworkProfile {
                label: "stub".into(),
                scheme: "sftp".into(),
                host: "example.invalid".into(),
                port: 22,
                username: "u".into(),
                auth_kind: AuthKind::Password,
                private_key_path: None,
                default_path: "/".into(),
            })
            .unwrap();
        self.profiles
            .update(
                &created.id,
                config::UpdateNetworkProfile {
                    label: created.label,
                    host: created.host,
                    port: created.port,
                    username: created.username,
                    auth_kind: AuthKind::PrivateKey,
                    private_key_path: Some(String::new()),
                    default_path: created.default_path,
                },
            )
            .unwrap()
            .id
    }

    fn manager(&self) -> ConnectionSessionManager {
        ConnectionSessionManager::new(
            self.profiles.clone(),
            self.secrets.clone(),
            self.registry.clone(),
        )
    }
}

#[tokio::test]
async fn connect_is_idempotent_when_session_is_already_alive() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    manager.connect(&profile_id).await.unwrap();
    manager.connect(&profile_id).await.unwrap();
    manager.connect(&profile_id).await.unwrap();

    assert_eq!(
        fixture.connector.connects.load(Ordering::SeqCst),
        1,
        "subsequent connect() calls should reuse the existing session"
    );
}

#[tokio::test]
async fn disconnect_drops_session_handle() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    manager.connect(&profile_id).await.unwrap();
    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Connected,
    );

    manager.disconnect(&profile_id).await.unwrap();

    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Disconnected,
    );
    assert_eq!(fixture.connector.disconnects.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn reap_idle_sessions_disconnects_stale_handles() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    manager.connect(&profile_id).await.unwrap();
    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Connected,
    );

    manager.reap_idle_sessions(Duration::from_millis(0)).await;

    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Disconnected,
    );
    assert_eq!(fixture.connector.disconnects.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn session_for_profile_reconnects_when_ping_fails() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    let flag = fixture.connector.kill_next_session_after_open();
    manager.connect(&profile_id).await.unwrap();

    *flag.lock().unwrap() = true;

    let _ = manager.session_for_profile(&profile_id).await.unwrap();
    assert_eq!(
        fixture.connector.connects.load(Ordering::SeqCst),
        2,
        "expected reconnect after ping failure"
    );
}

#[tokio::test]
async fn connect_emits_status_event() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();
    let mut rx = manager.subscribe_status();

    manager.connect(&profile_id).await.unwrap();
    let event = rx.recv().await.expect("status event after connect");

    assert_eq!(event.profile_id, profile_id);
    assert_eq!(event.status, ConnectionStatus::Connected);
}

#[tokio::test]
async fn disconnect_emits_status_event() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();
    manager.connect(&profile_id).await.unwrap();
    let mut rx = manager.subscribe_status();

    manager.disconnect(&profile_id).await.unwrap();
    let event = rx.recv().await.expect("status event after disconnect");

    assert_eq!(event.profile_id, profile_id);
    assert_eq!(event.status, ConnectionStatus::Disconnected);
}

#[tokio::test]
async fn concurrent_connect_calls_share_a_single_handshake() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = Arc::new(fixture.manager());

    let manager_a = manager.clone();
    let id_a = profile_id.clone();
    let task_a = tokio::spawn(async move { manager_a.connect(&id_a).await });

    let manager_b = manager.clone();
    let id_b = profile_id.clone();
    let task_b = tokio::spawn(async move { manager_b.connect(&id_b).await });

    task_a.await.unwrap().unwrap();
    task_b.await.unwrap().unwrap();

    assert_eq!(
        fixture.connector.connects.load(Ordering::SeqCst),
        1,
        "concurrent connects should coalesce into a single handshake"
    );
}
