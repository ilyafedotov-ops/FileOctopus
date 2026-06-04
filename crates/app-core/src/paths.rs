use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    pub log_dir: PathBuf,
    pub history_db: PathBuf,
    pub preferences_db: PathBuf,
    pub navigation_db: PathBuf,
    pub network_db: PathBuf,
    pub terminal_db: PathBuf,
}

impl AppPaths {
    pub fn ensure_directories(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.config_dir)?;
        std::fs::create_dir_all(&self.data_dir)?;
        std::fs::create_dir_all(&self.log_dir)?;

        if let Some(parent) = self.history_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        if let Some(parent) = self.preferences_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        if let Some(parent) = self.navigation_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        if let Some(parent) = self.network_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        if let Some(parent) = self.terminal_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        Ok(())
    }
}

impl Default for AppPaths {
    fn default() -> Self {
        let root = fileoctopus_home();

        Self {
            config_dir: root.join("config"),
            data_dir: root.clone(),
            log_dir: telemetry::default_log_dir(),
            history_db: root.join("operation-history.sqlite"),
            preferences_db: root.join("preferences.sqlite"),
            navigation_db: root.join("navigation.sqlite"),
            network_db: root.join("network.sqlite"),
            terminal_db: root.join("terminal.sqlite"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppDataHealth {
    pub config_dir: String,
    pub data_dir: String,
    pub log_dir: String,
    pub database_path: String,
    pub database_exists: bool,
    pub schema_version: u32,
    pub missing_directories: Vec<String>,
    pub startup_recovery_count: usize,
}

fn fileoctopus_home() -> PathBuf {
    if let Ok(dir) = std::env::var("FILEOCTOPUS_DATA_DIR") {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".fileoctopus")
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}
