use std::collections::HashMap;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use app_core::AppPaths;
use app_ipc::{
    IpcError, PluginInstallRequest, PluginInstallResponse, PluginListResponse, PluginToggleRequest,
    PluginToggleResponse, PluginUninstallRequest,
};
use plugin_core::{discover_plugins, InstalledPlugin};
use tauri::State;

pub(crate) struct PluginState {
    pub(crate) plugins_dir: PathBuf,
    state_path: PathBuf,
    pub(crate) plugins: Arc<Mutex<Vec<InstalledPlugin>>>,
}

impl PluginState {
    pub fn new(paths: &AppPaths) -> Self {
        let plugins_dir = paths.data_dir.join("plugins");
        Self {
            state_path: plugins_dir.join("state.json"),
            plugins_dir,
            plugins: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn refresh(&self) -> Result<(), IpcError> {
        let mut discovered = discover_plugins(&self.plugins_dir).map_err(|e| {
            let msg = format!("plugin discovery failed: {e}");
            IpcError::internal(msg.as_str())
        })?;
        let enabled = self.load_enabled_state()?;
        for plugin in &mut discovered {
            if let Some(value) = enabled.get(&plugin.manifest.id) {
                plugin.enabled = *value;
            }
        }
        let mut plugins = self
            .plugins
            .lock()
            .map_err(|_| IpcError::internal("plugin state lock poisoned"))?;
        *plugins = discovered;
        Ok(())
    }

    fn load_enabled_state(&self) -> Result<HashMap<String, bool>, IpcError> {
        if !self.state_path.exists() {
            return Ok(HashMap::new());
        }
        let bytes = std::fs::read(&self.state_path)
            .map_err(|error| IpcError::io(format!("cannot read plugin state: {error}")))?;
        serde_json::from_slice(&bytes)
            .map_err(|error| IpcError::internal(&format!("invalid plugin state: {error}")))
    }

    fn persist_enabled_state(&self, plugins: &[InstalledPlugin]) -> Result<(), IpcError> {
        std::fs::create_dir_all(&self.plugins_dir)
            .map_err(|error| IpcError::io(format!("cannot create plugin directory: {error}")))?;
        let state = plugins
            .iter()
            .map(|plugin| (plugin.manifest.id.clone(), plugin.enabled))
            .collect::<HashMap<_, _>>();
        let bytes = serde_json::to_vec(&state)
            .map_err(|error| IpcError::internal(&format!("cannot encode plugin state: {error}")))?;
        let temporary = self
            .plugins_dir
            .join(format!(".state-{}.tmp", uuid::Uuid::new_v4()));
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| IpcError::io(format!("cannot create plugin state: {error}")))?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| IpcError::io(format!("cannot write plugin state: {error}")))?;
        if let Err(error) = std::fs::rename(&temporary, &self.state_path) {
            if !self.state_path.exists() {
                return Err(IpcError::io(format!("cannot save plugin state: {error}")));
            }
            std::fs::remove_file(&self.state_path).map_err(|remove_error| {
                IpcError::io(format!("cannot replace plugin state: {remove_error}"))
            })?;
            std::fs::rename(&temporary, &self.state_path).map_err(|rename_error| {
                IpcError::io(format!("cannot replace plugin state: {rename_error}"))
            })?;
        }
        Ok(())
    }
}

fn refresh_and_list(state: &PluginState) -> Result<PluginListResponse, IpcError> {
    state.refresh()?;
    let plugins = state
        .plugins
        .lock()
        .map_err(|_| IpcError::internal("plugin state lock poisoned"))?;
    Ok(PluginListResponse {
        plugins: plugins.clone().into_iter().map(Into::into).collect(),
    })
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            _ => normalized.push(component.as_os_str()),
        }
    }
    normalized
}

fn ensure_plugin_path_contained(root: &Path, path: &Path) -> Result<(), IpcError> {
    let root = root.canonicalize().unwrap_or_else(|_| normalize_path(root));
    let path = path.canonicalize().unwrap_or_else(|_| normalize_path(path));
    if path.starts_with(&root) {
        Ok(())
    } else {
        Err(IpcError::invalid_request(
            "plugin path escapes the plugins directory",
        ))
    }
}

#[cfg(test)]
fn plugin_destination(root: &Path, plugin_id: &str) -> Result<PathBuf, IpcError> {
    if plugin_id.contains('/') || plugin_id.contains('\\') || plugin_id.contains("..") {
        return Err(IpcError::invalid_request("invalid plugin id"));
    }
    let destination = root.join(plugin_id);
    ensure_plugin_path_contained(root, &destination)?;
    Ok(destination)
}

#[tauri::command]
pub async fn plugin_list(state: State<'_, PluginState>) -> Result<PluginListResponse, IpcError> {
    refresh_and_list(&state)
}

#[tauri::command]
pub async fn plugin_install(
    _request: PluginInstallRequest,
    _state: State<'_, PluginState>,
) -> Result<PluginInstallResponse, IpcError> {
    Err(IpcError::new(
        app_ipc::error_codes::UNSUPPORTED_TRANSPORT,
        "plugin installation is disabled until signed Wasm packages are supported",
    ))
}

#[tauri::command]
pub async fn plugin_uninstall(
    request: PluginUninstallRequest,
    state: State<'_, PluginState>,
) -> Result<app_ipc::OkResponse, IpcError> {
    let mut plugins = state
        .plugins
        .lock()
        .map_err(|_| IpcError::internal("plugin state lock poisoned"))?;

    let idx = plugins
        .iter()
        .position(|p| p.manifest.id == request.plugin_id)
        .ok_or_else(|| IpcError::not_found(format!("plugin not found: {}", request.plugin_id)))?;

    let install_path = plugins[idx].install_path.clone();
    ensure_plugin_path_contained(&state.plugins_dir, &install_path)?;

    if install_path.exists() {
        std::fs::remove_dir_all(&install_path)
            .map_err(|e| IpcError::io(format!("cannot remove plugin directory: {e}")))?;
    }
    plugins.remove(idx);
    state.persist_enabled_state(&plugins)?;

    Ok(app_ipc::OkResponse { ok: true })
}

#[tauri::command]
pub async fn plugin_toggle(
    request: PluginToggleRequest,
    state: State<'_, PluginState>,
) -> Result<PluginToggleResponse, IpcError> {
    let mut plugins = state
        .plugins
        .lock()
        .map_err(|_| IpcError::internal("plugin state lock poisoned"))?;

    let plugin = plugins
        .iter_mut()
        .find(|p| p.manifest.id == request.plugin_id)
        .ok_or_else(|| IpcError::not_found(format!("plugin not found: {}", request.plugin_id)))?;

    plugin.enabled = request.enabled;
    let plugin_dto: app_ipc::InstalledPluginDto = plugin.clone().into();
    state.persist_enabled_state(&plugins)?;

    Ok(PluginToggleResponse { plugin: plugin_dto })
}

#[cfg(test)]
mod tests {
    use super::*;
    use app_core::AppPaths;
    use plugin_core::MANIFEST_FILENAME;
    use std::fs;

    fn test_paths(dir: &std::path::Path) -> AppPaths {
        AppPaths {
            config_dir: dir.join("config"),
            data_dir: dir.to_path_buf(),
            log_dir: dir.join("logs"),
            history_db: dir.join("history.sqlite"),
            preferences_db: dir.join("prefs.sqlite"),
            navigation_db: dir.join("nav.sqlite"),
            network_db: dir.join("net.sqlite"),
            terminal_db: dir.join("terminal.sqlite"),
        }
    }

    fn sample_manifest_json() -> String {
        r#"{
            "id": "com.example.test",
            "name": "Test Plugin",
            "version": "1.0.0",
            "description": "A test plugin",
            "author": "Test",
            "entryPoint": "main.js",
            "permissions": ["readFiles"],
            "minAppVersion": "0.1.0"
        }"#
        .to_string()
    }

    #[test]
    fn plugin_state_refresh_discovers_plugins() {
        let dir = tempfile::tempdir().unwrap();
        let paths = test_paths(dir.path());
        let plugins_dir = dir.path().join("plugins");
        let plugin_dir = plugins_dir.join("com.example.test");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join(MANIFEST_FILENAME), sample_manifest_json()).unwrap();

        let state = PluginState::new(&paths);
        state.refresh().unwrap();

        let plugins = state.plugins.lock().unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].manifest.id, "com.example.test");
        assert!(plugins[0].enabled);
    }

    #[test]
    fn plugin_state_refresh_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let paths = test_paths(dir.path());
        let state = PluginState::new(&paths);
        state.refresh().unwrap();

        let plugins = state.plugins.lock().unwrap();
        assert!(plugins.is_empty());
    }

    #[test]
    fn refresh_and_list_returns_dto_list() {
        let dir = tempfile::tempdir().unwrap();
        let paths = test_paths(dir.path());
        let plugins_dir = dir.path().join("plugins");
        let plugin_dir = plugins_dir.join("com.example.test");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join(MANIFEST_FILENAME), sample_manifest_json()).unwrap();

        let state = PluginState::new(&paths);
        let response = refresh_and_list(&state).unwrap();

        assert_eq!(response.plugins.len(), 1);
        assert_eq!(response.plugins[0].manifest.id, "com.example.test");
        assert_eq!(response.plugins[0].manifest.name, "Test Plugin");
        assert!(response.plugins[0].enabled);
    }

    #[test]
    fn enabled_state_survives_refresh_and_restart() {
        let dir = tempfile::tempdir().unwrap();
        let paths = test_paths(dir.path());
        let plugin_dir = dir.path().join("plugins/com.example.test");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join(MANIFEST_FILENAME), sample_manifest_json()).unwrap();

        let state = PluginState::new(&paths);
        state.refresh().unwrap();
        {
            let mut plugins = state.plugins.lock().unwrap();
            plugins[0].enabled = false;
            state.persist_enabled_state(&plugins).unwrap();
        }

        let restarted = PluginState::new(&paths);
        restarted.refresh().unwrap();
        assert!(!restarted.plugins.lock().unwrap()[0].enabled);
    }

    #[test]
    fn plugin_destination_must_stay_inside_plugins_dir() {
        let root = PathBuf::from("/tmp/fileoctopus/plugins");
        assert!(plugin_destination(&root, "com.example.test").is_ok());
        assert!(plugin_destination(&root, "../escape").is_err());
        assert!(plugin_destination(&root, "/tmp/escape").is_err());
    }

    #[test]
    fn plugin_uninstall_path_must_stay_inside_plugins_dir() {
        let root = PathBuf::from("/tmp/fileoctopus/plugins");
        assert!(ensure_plugin_path_contained(&root, &root.join("com.example.test")).is_ok());
        assert!(
            ensure_plugin_path_contained(&root, &PathBuf::from("/tmp/fileoctopus/escape")).is_err()
        );
    }
}
