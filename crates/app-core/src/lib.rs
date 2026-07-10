use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use config::{
    NavigationRepository, NetworkProfileRepository, PreferencesRepository,
    TerminalProfileRepository,
};
use fs_core::{vfs_io::VfsFilesystem, LocalFsProvider};
use git_intel::GitService;
use platform::SecretStore;
use provider_s3::{S3Connector, S3Provider};
use provider_sftp::{SftpConnector, SftpProvider};
use provider_webdav::{WebDavConnector, WebDavProvider};
use remote_core::{ConnectionSessionManager, RemoteConnectorRegistry};
use terminal_core::TerminalService;
use thiserror::Error;
use vfs::VfsRegistry;

#[cfg(test)]
pub(crate) static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub mod boot_config;
pub mod history;
pub mod paths;
pub mod runtime;

pub use boot_config::is_network_enabled;
pub use history::{OperationHistoryRecord, OperationHistoryRepository};
pub use paths::{AppDataHealth, AppPaths};
pub use runtime::OperationRuntime;

pub fn operation_idle_timeout_from_secs(secs: u32) -> Option<Duration> {
    match secs {
        0 => None,
        secs => Some(Duration::from_secs(u64::from(secs))),
    }
}

#[derive(Debug, Error)]
pub enum AppCoreError {
    #[error("failed to initialize telemetry: {0}")]
    Telemetry(String),
    #[error("failed to initialize VFS: {0}")]
    Vfs(String),
    #[error("failed to initialize operation history: {0}")]
    History(String),
    #[error("failed to initialize network profiles: {0}")]
    Network(String),
}

#[derive(Clone)]
pub struct AppState {
    vfs: Arc<VfsRegistry>,
    operations: Arc<OperationRuntime>,
    preferences: PreferencesRepository,
    navigation: NavigationRepository,
    network: NetworkProfileRepository,
    terminal_profiles: TerminalProfileRepository,
    sessions: Arc<ConnectionSessionManager>,
    secrets: SecretStore,
    paths: AppPaths,
    startup_recovery_count: usize,
    terminals: Arc<TerminalService>,
    git: Arc<GitService>,
}

impl AppState {
    pub fn vfs(&self) -> Arc<VfsRegistry> {
        self.vfs.clone()
    }

    pub fn operations(&self) -> Arc<OperationRuntime> {
        self.operations.clone()
    }

    pub fn preferences(&self) -> &PreferencesRepository {
        &self.preferences
    }

    pub fn navigation(&self) -> &NavigationRepository {
        &self.navigation
    }

    pub fn network(&self) -> &NetworkProfileRepository {
        &self.network
    }

    pub fn terminal_profiles(&self) -> &TerminalProfileRepository {
        &self.terminal_profiles
    }

    pub fn sessions(&self) -> Arc<ConnectionSessionManager> {
        self.sessions.clone()
    }

    pub fn secrets(&self) -> &SecretStore {
        &self.secrets
    }

    pub fn app_data_health(&self) -> AppDataHealth {
        let schema_version = self.operations.schema_version().unwrap_or(0);
        let database_exists = self.paths.history_db.exists();
        let mut missing_directories = Vec::new();

        for (name, path) in [
            ("configDir", &self.paths.config_dir),
            ("dataDir", &self.paths.data_dir),
            ("logDir", &self.paths.log_dir),
        ] {
            if !path.exists() {
                missing_directories.push(name.to_string());
            }
        }

        AppDataHealth {
            config_dir: self.paths.config_dir.to_string_lossy().to_string(),
            data_dir: self.paths.data_dir.to_string_lossy().to_string(),
            log_dir: self.paths.log_dir.to_string_lossy().to_string(),
            database_path: self.paths.history_db.to_string_lossy().to_string(),
            database_exists,
            schema_version,
            missing_directories,
            startup_recovery_count: self.startup_recovery_count,
        }
    }

    pub fn paths(&self) -> &AppPaths {
        &self.paths
    }

    pub fn terminals(&self) -> Arc<TerminalService> {
        self.terminals.clone()
    }

    pub fn git(&self) -> Arc<GitService> {
        self.git.clone()
    }
}

pub struct AppCore;

#[derive(Clone, Copy)]
enum NetworkProviderKind {
    Sftp,
    S3,
    WebDav,
}

const NETWORK_PROVIDERS: &[NetworkProviderKind] = &[
    NetworkProviderKind::Sftp,
    NetworkProviderKind::S3,
    NetworkProviderKind::WebDav,
];

#[cfg(test)]
pub(crate) fn network_provider_schemes() -> impl Iterator<Item = &'static str> {
    NETWORK_PROVIDERS.iter().map(NetworkProviderKind::scheme)
}

impl NetworkProviderKind {
    #[cfg(test)]
    fn scheme(&self) -> &'static str {
        match self {
            Self::Sftp => "sftp",
            Self::S3 => "s3",
            Self::WebDav => "webdav",
        }
    }

    fn register_connector(&self, registry: &mut RemoteConnectorRegistry) {
        match self {
            Self::Sftp => {
                let connector = Arc::new(SftpConnector::new());
                registry.register(connector.clone());
                registry.register_alias("ssh", connector);
            }
            Self::S3 => registry.register(Arc::new(S3Connector::new())),
            Self::WebDav => registry.register(Arc::new(WebDavConnector::new())),
        }
    }

    fn register_provider(
        &self,
        vfs: &VfsRegistry,
        sessions: Arc<ConnectionSessionManager>,
    ) -> Result<(), AppCoreError> {
        let result = match self {
            Self::Sftp => vfs.register(Arc::new(SftpProvider::new(sessions))),
            Self::S3 => vfs.register(Arc::new(S3Provider::new(sessions))),
            Self::WebDav => vfs.register(Arc::new(WebDavProvider::new(sessions))),
        };

        result.map_err(|error| AppCoreError::Vfs(error.to_string()))
    }
}

fn register_network_connectors(registry: &mut RemoteConnectorRegistry) {
    for provider in NETWORK_PROVIDERS {
        provider.register_connector(registry);
    }
}

fn register_network_vfs_providers(
    vfs: &VfsRegistry,
    sessions: Arc<ConnectionSessionManager>,
) -> Result<(), AppCoreError> {
    for provider in NETWORK_PROVIDERS {
        provider.register_provider(vfs, sessions.clone())?;
    }

    Ok(())
}

impl AppCore {
    pub fn boot() -> Result<Arc<AppState>, AppCoreError> {
        let paths = AppPaths::default();

        Self::boot_with_paths(paths)
    }

    pub fn boot_with_history_path(history_path: PathBuf) -> Result<Arc<AppState>, AppCoreError> {
        let paths = AppPaths {
            history_db: history_path,
            ..AppPaths::default()
        };

        Self::boot_with_paths(paths)
    }

    pub fn boot_with_paths(paths: AppPaths) -> Result<Arc<AppState>, AppCoreError> {
        telemetry::init_at(paths.log_dir.clone())
            .map_err(|error| AppCoreError::Telemetry(error.to_string()))?;
        paths
            .ensure_directories()
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        let secrets = SecretStore::new();
        let network = NetworkProfileRepository::new(paths.network_db.clone())
            .map_err(|error| AppCoreError::Network(error.to_string()))?;
        let terminal_profiles = TerminalProfileRepository::new(paths.terminal_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        let network_enabled = is_network_enabled();
        let mut connector_registry = RemoteConnectorRegistry::new();
        if network_enabled {
            register_network_connectors(&mut connector_registry);
        }
        let connector_registry = Arc::new(tokio::sync::RwLock::new(connector_registry));
        let sessions = Arc::new(ConnectionSessionManager::new(
            network.clone(),
            secrets.clone(),
            connector_registry,
        ));

        let vfs = Arc::new(VfsRegistry::new());
        vfs.register(Arc::new(LocalFsProvider::new()))
            .map_err(|error| AppCoreError::Vfs(error.to_string()))?;
        if network_enabled {
            register_network_vfs_providers(&vfs, sessions.clone())?;
        }

        let preferences = PreferencesRepository::new(paths.preferences_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let user_preferences = preferences
            .get_all()
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let history = OperationHistoryRepository::new(paths.history_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let startup_recovery_count = history
            .mark_interrupted_jobs()
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let vfs_filesystem = VfsFilesystem::with_sessions(sessions.clone(), vfs.clone());
        let operations = Arc::new(OperationRuntime::with_settings(
            vfs_filesystem,
            history,
            runtime::RuntimeSettings {
                idle_timeout: operation_idle_timeout_from_secs(
                    user_preferences.operation_idle_timeout_secs,
                ),
                ..Default::default()
            },
        ));
        let navigation = NavigationRepository::new(paths.navigation_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        paths
            .secure_database_files()
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        let terminals = Arc::new(TerminalService::new());
        let git = Arc::new(GitService::new());

        telemetry::info("FileOctopus app core booted");

        Ok(Arc::new(AppState {
            vfs,
            operations,
            preferences,
            navigation,
            network,
            terminal_profiles,
            sessions,
            secrets,
            paths,
            startup_recovery_count,
            terminals,
            git,
        }))
    }
}

#[cfg(test)]
mod tests;
