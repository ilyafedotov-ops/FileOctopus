use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use app_core::AppPaths;
use app_ipc::{
    IpcError, PluginInstallRequest, PluginInstallResponse, PluginListResponse, PluginToggleRequest,
    PluginToggleResponse, PluginUninstallRequest,
};
use plugin_core::{discover_plugins, parse_manifest, InstalledPlugin, MANIFEST_FILENAME};
use tauri::State;

pub(crate) struct PluginState {
    pub(crate) plugins_dir: PathBuf,
    pub(crate) plugins: Arc<Mutex<Vec<InstalledPlugin>>>,
}

impl PluginState {
    pub fn new(paths: &AppPaths) -> Self {
        Self {
            plugins_dir: paths.data_dir.join("plugins"),
            plugins: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn refresh(&self) -> Result<(), IpcError> {
        let discovered = discover_plugins(&self.plugins_dir).map_err(|e| {
            let msg = format!("plugin discovery failed: {e}");
            IpcError::internal(msg.as_str())
        })?;
        let mut plugins = self
            .plugins
            .lock()
            .map_err(|_| IpcError::internal("plugin state lock poisoned"))?;
        *plugins = discovered;
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

#[tauri::command]
pub async fn plugin_list(state: State<'_, PluginState>) -> Result<PluginListResponse, IpcError> {
    refresh_and_list(&state)
}

#[tauri::command]
pub async fn plugin_install(
    request: PluginInstallRequest,
    state: State<'_, PluginState>,
) -> Result<PluginInstallResponse, IpcError> {
    let source = PathBuf::from(&request.source_path);
    if !source.exists() {
        return Err(IpcError::not_found(format!(
            "source path not found: {}",
            request.source_path
        )));
    }

    let manifest_json = std::fs::read_to_string(source.join(MANIFEST_FILENAME))
        .map_err(|e| IpcError::invalid_request(format!("cannot read manifest: {e}")))?;
    let manifest =
        parse_manifest(&manifest_json).map_err(|e| IpcError::invalid_request(format!("{e}")))?;

    let dest_dir = state.plugins_dir.join(&manifest.id);
    if dest_dir.exists() {
        return Err(IpcError::invalid_request(format!(
            "plugin already installed: {}",
            manifest.id
        )));
    }

    std::fs::create_dir_all(&dest_dir)
        .map_err(|e| IpcError::io(format!("cannot create plugin directory: {e}")))?;

    for entry in std::fs::read_dir(&source)
        .map_err(|e| IpcError::io(format!("cannot read source directory: {e}")))?
    {
        let entry = entry.map_err(|e| IpcError::io(format!("cannot read entry: {e}")))?;
        let file_name = entry.file_name();
        let dest_file = dest_dir.join(&file_name);
        std::fs::copy(entry.path(), &dest_file)
            .map_err(|e| IpcError::io(format!("cannot copy file: {e}")))?;
    }

    let installed = InstalledPlugin {
        manifest,
        install_path: dest_dir,
        enabled: true,
    };

    let plugin_dto: app_ipc::InstalledPluginDto = installed.clone().into();

    let mut plugins = state
        .plugins
        .lock()
        .map_err(|_| IpcError::internal("plugin state lock poisoned"))?;
    plugins.push(installed);

    Ok(PluginInstallResponse { plugin: plugin_dto })
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
    plugins.remove(idx);
    drop(plugins);

    if install_path.exists() {
        std::fs::remove_dir_all(&install_path)
            .map_err(|e| IpcError::io(format!("cannot remove plugin directory: {e}")))?;
    }

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

    Ok(PluginToggleResponse { plugin: plugin_dto })
}

#[cfg(test)]
mod tests {
    use super::*;
    use app_core::AppPaths;
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
}
