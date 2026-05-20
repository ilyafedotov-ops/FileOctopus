use std::path::PathBuf;
use std::sync::Arc;

use config::{NavigationRepository, NetworkProfileRepository, PreferencesRepository};
use fs_core::{vfs_io::VfsFilesystem, LocalFsProvider};
use platform::SecretStore;
use provider_sftp::{SftpConnector, SftpProvider};
use remote_core::{ConnectionSessionManager, RemoteConnectorRegistry};
use terminal_core::TerminalService;
use thiserror::Error;
use vfs::VfsRegistry;

pub mod boot_config;
pub mod history;
pub mod paths;
pub mod runtime;

pub use boot_config::is_network_enabled;
pub use history::{OperationHistoryRecord, OperationHistoryRepository};
pub use paths::{AppDataHealth, AppPaths};
pub use runtime::OperationRuntime;

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
    sessions: Arc<ConnectionSessionManager>,
    secrets: SecretStore,
    paths: AppPaths,
    startup_recovery_count: usize,
    terminals: Arc<TerminalService>,
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
}

pub struct AppCore;

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
        telemetry::init().map_err(|error| AppCoreError::Telemetry(error.to_string()))?;
        paths
            .ensure_directories()
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        let secrets = SecretStore::new();
        let network = NetworkProfileRepository::new(paths.network_db.clone())
            .map_err(|error| AppCoreError::Network(error.to_string()))?;

        let mut connector_registry = RemoteConnectorRegistry::new();
        connector_registry.register(Arc::new(SftpConnector::new()));
        let connector_registry = Arc::new(tokio::sync::RwLock::new(connector_registry));
        let sessions = Arc::new(ConnectionSessionManager::new(
            network.clone(),
            secrets.clone(),
            connector_registry,
        ));

        let vfs = Arc::new(VfsRegistry::new());
        vfs.register(Arc::new(LocalFsProvider::new()))
            .map_err(|error| AppCoreError::Vfs(error.to_string()))?;
        vfs.register(Arc::new(SftpProvider::new(sessions.clone())))
            .map_err(|error| AppCoreError::Vfs(error.to_string()))?;

        let history = OperationHistoryRepository::new(paths.history_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let startup_recovery_count = history
            .mark_interrupted_jobs()
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let vfs_filesystem = VfsFilesystem::with_sessions(sessions.clone());
        let operations = Arc::new(OperationRuntime::new(vfs_filesystem, history));
        let preferences = PreferencesRepository::new(paths.preferences_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let navigation = NavigationRepository::new(paths.navigation_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        let terminals = Arc::new(TerminalService::new());

        telemetry::info("FileOctopus app core booted");

        Ok(Arc::new(AppState {
            vfs,
            operations,
            preferences,
            navigation,
            network,
            sessions,
            secrets,
            paths,
            startup_recovery_count,
            terminals,
        }))
    }
}

#[cfg(test)]
mod tests;
