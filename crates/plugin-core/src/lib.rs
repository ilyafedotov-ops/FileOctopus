use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub entry_point: String,
    pub permissions: Vec<PluginPermission>,
    pub min_app_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PluginPermission {
    ReadFiles,
    WriteFiles,
    NetworkAccess,
    ClipboardAccess,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub manifest: PluginManifest,
    pub install_path: PathBuf,
    pub enabled: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum PluginError {
    #[error("plugin not found: {0}")]
    NotFound(String),
    #[error("invalid manifest: {0}")]
    InvalidManifest(String),
    #[error("plugin already installed: {0}")]
    AlreadyInstalled(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub const MANIFEST_FILENAME: &str = "plugin.json";

pub fn parse_manifest(json: &str) -> Result<PluginManifest, PluginError> {
    let manifest: PluginManifest =
        serde_json::from_str(json).map_err(|e| PluginError::InvalidManifest(e.to_string()))?;
    if !is_valid_plugin_id(&manifest.id) {
        return Err(PluginError::InvalidManifest("id is required".into()));
    }
    if manifest.name.is_empty() {
        return Err(PluginError::InvalidManifest("name is required".into()));
    }
    if manifest.version.is_empty() {
        return Err(PluginError::InvalidManifest("version is required".into()));
    }
    Ok(manifest)
}

fn is_valid_plugin_id(id: &str) -> bool {
    !id.trim().is_empty()
        && id == id.trim()
        && !id.starts_with('.')
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
        && id.split('.').all(|part| !part.is_empty())
}

pub fn discover_plugins(dir: &Path) -> Result<Vec<InstalledPlugin>, PluginError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut plugins = Vec::new();
    let entries = std::fs::read_dir(dir)?;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join(MANIFEST_FILENAME);
        if !manifest_path.exists() {
            continue;
        }
        let json = std::fs::read_to_string(&manifest_path)?;
        let manifest = parse_manifest(&json)?;
        plugins.push(InstalledPlugin {
            manifest,
            install_path: path,
            enabled: true,
        });
    }
    Ok(plugins)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn sample_manifest_json() -> String {
        r#"{
            "id": "com.example.hello",
            "name": "Hello World",
            "version": "1.0.0",
            "description": "A sample plugin",
            "author": "Example Author",
            "entryPoint": "main.js",
            "permissions": ["readFiles"],
            "minAppVersion": "0.1.0"
        }"#
        .to_string()
    }

    #[test]
    fn parse_valid_manifest() {
        let manifest = parse_manifest(&sample_manifest_json()).unwrap();
        assert_eq!(manifest.id, "com.example.hello");
        assert_eq!(manifest.name, "Hello World");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.entry_point, "main.js");
        assert_eq!(manifest.permissions.len(), 1);
        assert_eq!(manifest.permissions[0], PluginPermission::ReadFiles);
        assert_eq!(manifest.min_app_version.as_deref(), Some("0.1.0"));
    }

    #[test]
    fn parse_manifest_missing_id() {
        let json = r#"{
            "name": "No ID",
            "version": "1.0.0",
            "description": "Missing id",
            "author": "Test",
            "entryPoint": "main.js",
            "permissions": []
        }"#;
        let err = parse_manifest(json).unwrap_err();
        assert!(matches!(err, PluginError::InvalidManifest(_)));
    }

    #[test]
    fn parse_manifest_empty_id() {
        let json = r#"{
            "id": "",
            "name": "Empty ID",
            "version": "1.0.0",
            "description": "",
            "author": "Test",
            "entryPoint": "main.js",
            "permissions": []
        }"#;
        let err = parse_manifest(json).unwrap_err();
        assert!(matches!(err, PluginError::InvalidManifest(_)));
    }

    #[test]
    fn parse_manifest_rejects_path_like_id() {
        for id in [
            "../escape",
            "com/example/test",
            "com\\example\\test",
            "/tmp/plugin",
        ] {
            let json = serde_json::json!({
                "id": id,
                "name": "Path ID",
                "version": "1.0.0",
                "description": "",
                "author": "Test",
                "entryPoint": "main.js",
                "permissions": []
            })
            .to_string();
            let err = parse_manifest(&json).unwrap_err();
            assert!(
                matches!(err, PluginError::InvalidManifest(_)),
                "expected `{id}` to be rejected"
            );
        }
    }

    #[test]
    fn parse_manifest_empty_name() {
        let json = r#"{
            "id": "com.test.empty",
            "name": "",
            "version": "1.0.0",
            "description": "",
            "author": "Test",
            "entryPoint": "main.js",
            "permissions": []
        }"#;
        let err = parse_manifest(json).unwrap_err();
        assert!(matches!(err, PluginError::InvalidManifest(_)));
    }

    #[test]
    fn parse_manifest_empty_version() {
        let json = r#"{
            "id": "com.test.empty",
            "name": "Test",
            "version": "",
            "description": "",
            "author": "Test",
            "entryPoint": "main.js",
            "permissions": []
        }"#;
        let err = parse_manifest(json).unwrap_err();
        assert!(matches!(err, PluginError::InvalidManifest(_)));
    }

    #[test]
    fn parse_manifest_invalid_json() {
        let err = parse_manifest("not json").unwrap_err();
        assert!(matches!(err, PluginError::InvalidManifest(_)));
    }

    #[test]
    fn discover_plugins_from_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let plugins = discover_plugins(dir.path()).unwrap();
        assert!(plugins.is_empty());
    }

    #[test]
    fn discover_plugins_from_nonexistent_dir() {
        let plugins = discover_plugins(Path::new("/nonexistent/path")).unwrap();
        assert!(plugins.is_empty());
    }

    #[test]
    fn discover_plugins_finds_installed() {
        let dir = tempfile::tempdir().unwrap();
        let plugin_dir = dir.path().join("com.example.hello");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join(MANIFEST_FILENAME), sample_manifest_json()).unwrap();

        let plugins = discover_plugins(dir.path()).unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].manifest.id, "com.example.hello");
        assert_eq!(plugins[0].manifest.name, "Hello World");
        assert!(plugins[0].enabled);
    }

    #[test]
    fn discover_plugins_skips_dirs_without_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let empty_dir = dir.path().join("no-manifest");
        fs::create_dir_all(&empty_dir).unwrap();

        let plugins = discover_plugins(dir.path()).unwrap();
        assert!(plugins.is_empty());
    }

    #[test]
    fn discover_plugins_skips_files() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("readme.txt"), "not a plugin").unwrap();

        let plugins = discover_plugins(dir.path()).unwrap();
        assert!(plugins.is_empty());
    }
}
