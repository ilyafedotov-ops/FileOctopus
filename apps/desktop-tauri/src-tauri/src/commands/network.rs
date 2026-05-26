use std::collections::HashSet;
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "macos", test))]
use std::process::{Command, Stdio};
use std::sync::Arc;
#[cfg(any(target_os = "macos", test))]
use std::time::{Duration, Instant};

use app_core::{is_network_enabled, AppState};
use app_ipc::{
    FileEntryDto, IpcError, NetworkConnectionStatusDto, NetworkConnectionStatusResponse,
    NetworkNeighborhoodRequest, NetworkNeighborhoodResponse, NetworkProfileActionRequest,
    NetworkProfileAddRequest, NetworkProfileDeleteRequest, NetworkProfileDto,
    NetworkProfileResponse, NetworkProfileSetSecretRequest, NetworkProfileUpdateRequest,
    NetworkProfilesListResponse, OkResponse,
};
use config::{AuthKind, NewNetworkProfile, UpdateNetworkProfile};
use platform::SecretStore;
use remote_core::ConnectionStatus;
use tauri::State;
use vfs::{FileKind, ResourceUri};

fn network_error(error: config::NetworkError) -> IpcError {
    match error {
        config::NetworkError::ProfileNotFound => {
            IpcError::new(app_ipc::error_codes::NOT_FOUND, "network profile not found")
        }
        config::NetworkError::InvalidValue { field, reason } => IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            format!("invalid {field}: {reason}"),
        ),
        other => IpcError::network_error(other.to_string()),
    }
}

fn remote_error(error: remote_core::RemoteError) -> IpcError {
    match error {
        remote_core::RemoteError::SecretStore(platform::SecretStoreError::NotFound) => {
            IpcError::new(
                app_ipc::error_codes::AUTHENTICATION_FAILED,
                remote_core::MISSING_STORED_PASSWORD,
            )
        }
        other => IpcError::new(other.code(), other.to_string()),
    }
}

fn profile_to_dto(profile: config::NetworkProfile) -> NetworkProfileDto {
    let mut dto = NetworkProfileDto::from(profile.clone());
    dto.has_stored_secret = remote_core::AuthSecrets::profile_has_stored_secret(&profile);
    dto
}

fn secret_error(error: platform::SecretStoreError) -> IpcError {
    IpcError::network_error(error.to_string())
}

fn network_disabled_error() -> IpcError {
    IpcError::new(
        app_ipc::error_codes::NETWORK_DISABLED,
        "network features are disabled; set FILEOCTOPUS_ENABLE_NETWORK=1 to enable them",
    )
}

fn ensure_network_enabled() -> Result<(), IpcError> {
    if is_network_enabled() {
        Ok(())
    } else {
        Err(network_disabled_error())
    }
}

fn status_to_dto(profile_id: &str, status: ConnectionStatus) -> NetworkConnectionStatusDto {
    match status {
        ConnectionStatus::Connected => NetworkConnectionStatusDto {
            profile_id: profile_id.to_string(),
            status: "connected".to_string(),
            message: None,
        },
        ConnectionStatus::Disconnected => NetworkConnectionStatusDto {
            profile_id: profile_id.to_string(),
            status: "disconnected".to_string(),
            message: None,
        },
        ConnectionStatus::Error { message } => NetworkConnectionStatusDto {
            profile_id: profile_id.to_string(),
            status: "error".to_string(),
            message: Some(message),
        },
    }
}

#[allow(clippy::too_many_arguments)]
fn virtual_entry(
    uri: impl Into<String>,
    name: impl Into<String>,
    kind: FileKind,
    target_uri: Option<String>,
    virtual_kind: impl Into<String>,
    protocol: Option<&str>,
    status: Option<&str>,
    description: Option<String>,
) -> FileEntryDto {
    let can_list = kind == FileKind::Directory;
    FileEntryDto {
        uri: uri.into(),
        name: name.into(),
        extension: None,
        kind,
        size: None,
        modified_at: None,
        created_at: None,
        accessed_at: None,
        is_hidden: false,
        is_symlink: false,
        symlink_target: None,
        provider_id: "network".to_string(),
        can_read: target_uri.is_some(),
        can_list,
        can_write: false,
        can_delete: false,
        can_rename: false,
        permissions: None,
        owner: None,
        target_uri,
        virtual_kind: Some(virtual_kind.into()),
        protocol: protocol.map(str::to_string),
        status: status.map(str::to_string),
        description,
    }
}

fn local_uri_for_path(path: &Path) -> Option<String> {
    ResourceUri::from_local_path(path)
        .ok()
        .map(|uri| uri.as_str().to_string())
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn clean_cloud_label(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Cloud Storage");
    if name.contains("GoogleDrive") || name.contains("Google Drive") {
        return "Google Drive".to_string();
    }
    if name.contains("OneDrive") {
        return "OneDrive".to_string();
    }
    if name.contains("CloudDocs") || name.contains("iCloud") {
        return "iCloud Drive".to_string();
    }
    name.replace('-', " ")
}

fn cloud_slug(label: &str, index: usize) -> String {
    let slug = label
        .chars()
        .filter_map(|ch| {
            if ch.is_ascii_alphanumeric() {
                Some(ch.to_ascii_lowercase())
            } else if ch.is_whitespace() {
                Some('-')
            } else {
                None
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if slug.is_empty() {
        format!("cloud-{index}")
    } else {
        format!("{slug}-{index}")
    }
}

fn detect_cloud_storage_roots_from(home: &Path) -> Vec<(String, PathBuf)> {
    let mut candidates = Vec::new();
    let cloud_storage = home.join("Library/CloudStorage");
    if let Ok(read_dir) = std::fs::read_dir(&cloud_storage) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            let label = clean_cloud_label(&path);
            if matches!(label.as_str(), "Google Drive" | "OneDrive" | "iCloud Drive") {
                candidates.push((label, path));
            }
        }
    }

    candidates.push(("Google Drive".to_string(), home.join("Google Drive")));
    candidates.push(("OneDrive".to_string(), home.join("OneDrive")));
    candidates.push(("iCloud Drive".to_string(), home.join("iCloud Drive")));
    candidates.push((
        "iCloud Drive".to_string(),
        home.join("Library/Mobile Documents/com~apple~CloudDocs"),
    ));

    let mut seen = HashSet::new();
    let mut roots = Vec::new();
    for (label, path) in candidates {
        if !path.exists() {
            continue;
        }
        let canonical = path.canonicalize().unwrap_or(path);
        if seen.insert(canonical.clone()) {
            roots.push((label, canonical));
        }
    }
    roots.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(&right.1)));
    roots
}

fn cloud_entries() -> Vec<FileEntryDto> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };
    detect_cloud_storage_roots_from(&home)
        .into_iter()
        .enumerate()
        .filter_map(|(index, (label, path))| {
            local_uri_for_path(&path).map(|target| {
                virtual_entry(
                    format!("network:///cloud/{}", cloud_slug(&label, index)),
                    label.clone(),
                    FileKind::Directory,
                    Some(target),
                    "cloudDrive",
                    Some("cloud"),
                    Some("available"),
                    Some(format!("{}", path.display())),
                )
            })
        })
        .collect()
}

#[cfg(any(target_os = "macos", test))]
fn parse_dns_sd_browse(output: &str, protocol: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut seen = HashSet::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.contains(protocol) {
            continue;
        }
        let columns: Vec<&str> = trimmed.split_whitespace().collect();
        if columns.len() < 4 {
            continue;
        }
        let name = columns[columns.len().saturating_sub(1)].trim().to_string();
        if !name.is_empty() && !name.starts_with('_') && seen.insert(name.clone()) {
            names.push(name);
        }
    }
    names
}

#[cfg(any(target_os = "macos", test))]
fn command_output_with_timeout(mut command: Command, timeout: Duration) -> Option<String> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let started = Instant::now();
    loop {
        if child.try_wait().ok().flatten().is_some() {
            let output = child.wait_with_output().ok()?;
            return Some(String::from_utf8_lossy(&output.stdout).to_string());
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let output = child.wait_with_output().ok()?;
            return Some(String::from_utf8_lossy(&output.stdout).to_string());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn discover_lan_entries() -> Vec<FileEntryDto> {
    #[cfg(target_os = "macos")]
    {
        let services = [
            ("smb", "_smb._tcp", "SMB"),
            ("sftp", "_sftp-ssh._tcp", "SFTP"),
            ("webdav", "_webdav._tcp", "WebDAV"),
            ("webdav", "_webdavs._tcp", "WebDAV"),
        ];
        let mut entries = Vec::new();
        let mut seen = HashSet::new();
        for (protocol, service, label) in services {
            let mut command = Command::new("dns-sd");
            command.args(["-B", service, "local."]);
            let Some(output) = command_output_with_timeout(command, Duration::from_millis(900))
            else {
                continue;
            };
            for name in parse_dns_sd_browse(&output, service) {
                let key = format!("{protocol}:{name}");
                if !seen.insert(key) {
                    continue;
                }
                let slug = name
                    .chars()
                    .filter_map(|ch| {
                        if ch.is_ascii_alphanumeric() {
                            Some(ch.to_ascii_lowercase())
                        } else if ch.is_whitespace() || ch == '-' || ch == '_' {
                            Some('-')
                        } else {
                            None
                        }
                    })
                    .collect::<String>();
                entries.push(virtual_entry(
                    format!("network:///lan/{protocol}/{}", slug.trim_matches('-')),
                    name,
                    FileKind::Directory,
                    None,
                    "discoveredService",
                    Some(protocol),
                    Some("credentialsRequired"),
                    Some(format!("{label} service discovered on the local network")),
                ));
            }
        }
        entries
    }

    #[cfg(not(target_os = "macos"))]
    {
        Vec::new()
    }
}

fn saved_connection_entries(state: &AppState) -> Vec<FileEntryDto> {
    if !is_network_enabled() {
        return Vec::new();
    }
    state
        .network()
        .list()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|profile| {
            let dto = profile_to_dto(profile);
            if dto.default_uri.is_empty() {
                return None;
            }
            Some(virtual_entry(
                format!("network:///saved/{}", dto.id),
                dto.label,
                FileKind::Directory,
                Some(dto.default_uri),
                "savedConnection",
                Some(dto.scheme.as_str()),
                Some(if dto.has_stored_secret {
                    "saved"
                } else {
                    "credentialsRequired"
                }),
                dto.last_error,
            ))
        })
        .collect()
}

#[tauri::command]
pub async fn network_profiles_list(
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfilesListResponse, IpcError> {
    if !is_network_enabled() {
        return Ok(NetworkProfilesListResponse { profiles: vec![] });
    }

    let profiles = state
        .network()
        .list()
        .map_err(network_error)?
        .into_iter()
        .map(profile_to_dto)
        .collect();

    Ok(NetworkProfilesListResponse { profiles })
}

#[tauri::command]
pub fn network_profile_add(
    request: NetworkProfileAddRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfileResponse, IpcError> {
    ensure_network_enabled()?;
    let profile = state
        .network()
        .add(NewNetworkProfile {
            label: request.label,
            scheme: request.scheme,
            host: request.host,
            port: request.port,
            username: request.username,
            auth_kind: AuthKind::parse(&request.auth_kind).map_err(network_error)?,
            private_key_path: request.private_key_path,
            default_path: request.default_path,
        })
        .map_err(network_error)?;

    Ok(NetworkProfileResponse {
        profile: profile_to_dto(profile),
    })
}

#[tauri::command]
pub fn network_profile_update(
    request: NetworkProfileUpdateRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfileResponse, IpcError> {
    ensure_network_enabled()?;
    let profile = state
        .network()
        .update(
            &request.id,
            UpdateNetworkProfile {
                label: request.label,
                host: request.host,
                port: request.port,
                username: request.username,
                auth_kind: AuthKind::parse(&request.auth_kind).map_err(network_error)?,
                private_key_path: request.private_key_path,
                default_path: request.default_path,
            },
        )
        .map_err(network_error)?;

    Ok(NetworkProfileResponse {
        profile: profile_to_dto(profile),
    })
}

#[tauri::command]
pub async fn network_profile_delete(
    request: NetworkProfileDeleteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    let _ = state.sessions().disconnect(&request.id).await;

    state.network().delete(&request.id).map_err(network_error)?;
    let _ = state
        .secrets()
        .delete(&SecretStore::network_password_key(&request.id));
    let _ = state
        .secrets()
        .delete(&SecretStore::network_passphrase_key(&request.id));

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn network_profile_set_secret(
    request: NetworkProfileSetSecretRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    let profile = state.network().get(&request.id).map_err(network_error)?;
    let key = match request.secret_kind.as_str() {
        "password" => SecretStore::network_password_key(&request.id),
        "passphrase" => SecretStore::network_passphrase_key(&request.id),
        other => {
            return Err(IpcError::new(
                app_ipc::error_codes::INVALID_REQUEST,
                format!("unsupported secret kind `{other}`"),
            ))
        }
    };

    state
        .secrets()
        .set(&key, &request.value)
        .map_err(secret_error)?;

    if request.secret_kind == "password" {
        state
            .network()
            .set_has_stored_secret(&request.id, true)
            .map_err(network_error)?;
    }

    if request.secret_kind == "passphrase" && profile.auth_kind == AuthKind::PrivateKey {
        let _ = state.network().set_has_stored_secret(&request.id, true);
    }

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn network_connect(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    state
        .sessions()
        .connect(&request.id)
        .await
        .map_err(remote_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn network_disconnect(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    state
        .sessions()
        .disconnect(&request.id)
        .await
        .map_err(remote_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn network_connection_status(
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkConnectionStatusResponse, IpcError> {
    if !is_network_enabled() {
        return Ok(NetworkConnectionStatusResponse { statuses: vec![] });
    }

    let profiles = state.network().list().map_err(network_error)?;
    let mut statuses = Vec::with_capacity(profiles.len());

    for profile in profiles {
        let status = state.sessions().connection_status(&profile.id).await;
        statuses.push(status_to_dto(&profile.id, status));
    }

    Ok(NetworkConnectionStatusResponse { statuses })
}

fn neighborhood_normalize(uri: &str) -> Option<String> {
    if !uri.starts_with("network:///") {
        return None;
    }
    if uri == "network:///" {
        Some("network:///".to_string())
    } else {
        Some(uri.trim_end_matches('/').to_string())
    }
}

fn root_neighborhood_entries() -> Vec<FileEntryDto> {
    vec![
        virtual_entry(
            "network:///cloud",
            "Cloud Storage",
            FileKind::Directory,
            None,
            "group",
            Some("cloud"),
            Some("available"),
            Some("Google Drive, OneDrive, and iCloud Drive".to_string()),
        ),
        virtual_entry(
            "network:///lan",
            "Local Network",
            FileKind::Directory,
            None,
            "group",
            Some("lan"),
            Some("available"),
            Some("SMB, SFTP, and WebDAV services".to_string()),
        ),
        virtual_entry(
            "network:///saved",
            "Saved Connections",
            FileKind::Directory,
            None,
            "group",
            Some("profile"),
            Some("available"),
            Some("Saved SFTP, SMB, S3, and WebDAV profiles".to_string()),
        ),
        virtual_entry(
            "network:///add",
            "Add Connection",
            FileKind::Virtual,
            None,
            "addConnection",
            None,
            Some("available"),
            Some("Open the connection wizard".to_string()),
        ),
    ]
}

fn lan_neighborhood_entries() -> Vec<FileEntryDto> {
    let entries = discover_lan_entries();
    if entries.is_empty() {
        vec![virtual_entry(
            "network:///lan/empty",
            "No LAN services found",
            FileKind::Virtual,
            None,
            "empty",
            Some("lan"),
            Some("unavailable"),
            Some("Refresh after joining a network or enabling local discovery".to_string()),
        )]
    } else {
        entries
    }
}

fn neighborhood_entries_for(normalized: &str, state: &AppState) -> Vec<FileEntryDto> {
    match normalized {
        "network:///" => root_neighborhood_entries(),
        "network:///cloud" => cloud_entries(),
        "network:///lan" => lan_neighborhood_entries(),
        "network:///saved" => saved_connection_entries(state),
        "network:///add" => Vec::new(),
        _ => Vec::new(),
    }
}

#[tauri::command]
pub async fn network_discover_neighborhood(
    request: NetworkNeighborhoodRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkNeighborhoodResponse, IpcError> {
    let normalized = neighborhood_normalize(&request.uri).ok_or_else(|| {
        IpcError::new(
            app_ipc::error_codes::INVALID_URI,
            "network neighborhood URI must start with network:///",
        )
    })?;
    let entries = neighborhood_entries_for(&normalized, &state);

    Ok(NetworkNeighborhoodResponse {
        uri: request.uri,
        entries,
    })
}

#[tauri::command]
pub fn network_profile_forget_fingerprint(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    state
        .network()
        .clear_host_key_fingerprint(&request.id)
        .map_err(network_error)?;
    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn network_validate_uri(uri: String) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    ResourceUri::parse(&uri).map_err(IpcError::from)?;
    Ok(OkResponse { ok: true })
}

#[cfg(test)]
mod tests {
    use super::*;
    use app_core::AppPaths;
    use tempfile::tempdir;

    fn isolated_app_state(root: &std::path::Path) -> Arc<AppState> {
        let paths = AppPaths {
            config_dir: root.join("config"),
            data_dir: root.to_path_buf(),
            log_dir: root.join("logs"),
            history_db: root.join("history.sqlite"),
            preferences_db: root.join("preferences.sqlite"),
            navigation_db: root.join("navigation.sqlite"),
            network_db: root.join("network.sqlite"),
        };
        app_core::AppCore::boot_with_paths(paths).expect("boot AppCore for test")
    }

    #[test]
    fn cloud_detector_finds_and_dedupes_sync_roots() {
        let dir = tempdir().unwrap();
        let home = dir.path();
        let cloud = home.join("Library/CloudStorage");
        std::fs::create_dir_all(&cloud).unwrap();
        let google = cloud.join("GoogleDrive-user@example.com");
        let one_drive = cloud.join("OneDrive-Personal");
        let icloud = home.join("Library/Mobile Documents/com~apple~CloudDocs");
        std::fs::create_dir_all(&google).unwrap();
        std::fs::create_dir_all(&one_drive).unwrap();
        std::fs::create_dir_all(&icloud).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&google, home.join("Google Drive")).unwrap();

        let roots = detect_cloud_storage_roots_from(home);
        let labels: Vec<_> = roots.iter().map(|(label, _)| label.as_str()).collect();

        assert_eq!(
            labels
                .iter()
                .filter(|label| **label == "Google Drive")
                .count(),
            1
        );
        assert!(labels.contains(&"OneDrive"));
        assert!(labels.contains(&"iCloud Drive"));
    }

    #[test]
    fn cloud_detector_returns_empty_when_home_has_no_sync_roots() {
        let dir = tempdir().unwrap();

        let roots = detect_cloud_storage_roots_from(dir.path());

        assert!(roots.is_empty());
    }

    #[test]
    fn dns_sd_parser_handles_empty_and_service_lines() {
        let empty = parse_dns_sd_browse("", "_smb._tcp");
        assert!(empty.is_empty());

        let output = "\
Browsing for _smb._tcp.local.
DATE: ---Tue 26 May 2026---
20:00:00.000  Add        3  14 local.               _smb._tcp.          NAS
20:00:00.100  Add        3  14 local.               _smb._tcp.          NAS
";
        let names = parse_dns_sd_browse(output, "_smb._tcp");

        assert_eq!(names, vec!["NAS"]);
    }

    #[test]
    fn dns_sd_parser_ignores_service_type_lines_and_other_services() {
        let output = "\
Browsing for _sftp-ssh._tcp.local.
20:00:00.000  Add        3  14 local.               _sftp-ssh._tcp.     deploy-box
20:00:00.001  Add        3  14 local.               _smb._tcp.          should-not-appear
20:00:00.002  Add        3  14 local.               _sftp-ssh._tcp.     _legacy
";
        let names = parse_dns_sd_browse(output, "_sftp-ssh._tcp");

        assert_eq!(names, vec!["deploy-box"]);
    }

    #[test]
    fn dns_sd_parser_dedupes_repeated_announcements() {
        let output = "\
20:00:00.000  Add        3  14 local.               _smb._tcp.          NAS
20:00:00.100  Add        3  14 local.               _smb._tcp.          NAS
20:00:00.200  Add        3  14 local.               _smb._tcp.          other
";
        let names = parse_dns_sd_browse(output, "_smb._tcp");

        assert_eq!(names, vec!["NAS", "other"]);
    }

    #[test]
    fn cloud_slug_handles_spaces_and_punctuation() {
        assert_eq!(cloud_slug("Google Drive", 0), "google-drive-0");
        assert_eq!(cloud_slug("iCloud Drive", 2), "icloud-drive-2");
        assert_eq!(cloud_slug("OneDrive!", 5), "onedrive-5");
    }

    #[test]
    fn cloud_slug_falls_back_when_label_has_no_alphanumerics() {
        assert_eq!(cloud_slug("***", 7), "cloud-7");
        assert_eq!(cloud_slug("", 0), "cloud-0");
    }

    #[test]
    fn clean_cloud_label_recognises_known_providers() {
        assert_eq!(
            clean_cloud_label(std::path::Path::new("/foo/GoogleDrive-acct")),
            "Google Drive"
        );
        assert_eq!(
            clean_cloud_label(std::path::Path::new("/foo/OneDrive-Personal")),
            "OneDrive"
        );
        assert_eq!(
            clean_cloud_label(std::path::Path::new(
                "/foo/Library/Mobile Documents/com~apple~CloudDocs"
            )),
            "iCloud Drive"
        );
        assert_eq!(
            clean_cloud_label(std::path::Path::new("/foo/Box-Sync")),
            "Box Sync"
        );
    }

    #[test]
    fn virtual_entry_marks_can_list_for_directories_only() {
        let dir = virtual_entry(
            "network:///cloud",
            "Cloud",
            FileKind::Directory,
            None,
            "group",
            Some("cloud"),
            Some("available"),
            None,
        );
        let action = virtual_entry(
            "network:///add",
            "Add",
            FileKind::Virtual,
            None,
            "addConnection",
            None,
            Some("available"),
            None,
        );

        assert!(dir.can_list);
        assert!(!dir.can_read);
        assert_eq!(dir.provider_id, "network");
        assert_eq!(dir.virtual_kind.as_deref(), Some("group"));
        assert!(!action.can_list);
    }

    #[test]
    fn virtual_entry_sets_can_read_when_target_present() {
        let entry = virtual_entry(
            "network:///cloud/icloud",
            "iCloud",
            FileKind::Directory,
            Some("local:///Users/me/iCloud".to_string()),
            "cloudDrive",
            Some("cloud"),
            Some("available"),
            Some("body".to_string()),
        );

        assert!(entry.can_read);
        assert_eq!(
            entry.target_uri.as_deref(),
            Some("local:///Users/me/iCloud")
        );
    }

    #[test]
    fn neighborhood_normalize_accepts_root_and_trims_trailing_slashes() {
        assert_eq!(
            neighborhood_normalize("network:///").as_deref(),
            Some("network:///")
        );
        assert_eq!(
            neighborhood_normalize("network:///cloud/").as_deref(),
            Some("network:///cloud")
        );
        assert_eq!(
            neighborhood_normalize("network:///saved").as_deref(),
            Some("network:///saved")
        );
    }

    #[test]
    fn neighborhood_normalize_rejects_non_network_uris() {
        assert!(neighborhood_normalize("local:///").is_none());
        assert!(neighborhood_normalize("network://").is_none());
        assert!(neighborhood_normalize("network:/").is_none());
        assert!(neighborhood_normalize("").is_none());
    }

    #[test]
    fn root_neighborhood_entries_returns_four_groups_with_expected_uris() {
        let entries = root_neighborhood_entries();
        let uris: Vec<&str> = entries.iter().map(|entry| entry.uri.as_str()).collect();

        assert_eq!(
            uris,
            vec![
                "network:///cloud",
                "network:///lan",
                "network:///saved",
                "network:///add",
            ]
        );
        // First three are groups (directory), last is action (virtual)
        assert_eq!(
            entries[0..3]
                .iter()
                .map(|entry| entry.virtual_kind.as_deref().unwrap())
                .collect::<Vec<_>>(),
            vec!["group", "group", "group"]
        );
        assert_eq!(entries[3].virtual_kind.as_deref(), Some("addConnection"));
        assert_eq!(entries[3].kind, FileKind::Virtual);
    }

    #[test]
    fn lan_neighborhood_entries_is_never_empty() {
        // Contract: callers should always be able to render *something* for
        // the LAN group — either discovered services on macOS, or the empty
        // placeholder on every other platform (and when discovery fails).
        let entries = lan_neighborhood_entries();
        assert!(!entries.is_empty());

        // Every entry is a network-provider entry with a populated URI.
        for entry in &entries {
            assert_eq!(entry.provider_id, "network");
            assert!(entry.uri.starts_with("network:///lan"));
            assert!(entry.virtual_kind.is_some());
        }

        // Every placeholder entry is virtual; every real entry is a directory.
        for entry in &entries {
            if entry.virtual_kind.as_deref() == Some("empty") {
                assert_eq!(entry.uri, "network:///lan/empty");
                assert_eq!(entry.kind, FileKind::Virtual);
                assert_eq!(entry.status.as_deref(), Some("unavailable"));
            } else {
                assert_eq!(entry.virtual_kind.as_deref(), Some("discoveredService"));
                assert_eq!(entry.kind, FileKind::Directory);
                assert!(entry.protocol.is_some());
                assert_eq!(entry.status.as_deref(), Some("credentialsRequired"));
            }
        }
    }

    #[test]
    fn neighborhood_entries_for_unknown_uri_is_empty() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let entries = neighborhood_entries_for("network:///unknown", &state);

        assert!(entries.is_empty());
    }

    #[test]
    fn neighborhood_entries_for_add_is_empty() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let entries = neighborhood_entries_for("network:///add", &state);

        assert!(entries.is_empty());
    }

    #[test]
    fn neighborhood_entries_for_root_matches_root_helper() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let direct = root_neighborhood_entries();
        let dispatched = neighborhood_entries_for("network:///", &state);

        assert_eq!(
            direct.iter().map(|e| e.uri.as_str()).collect::<Vec<_>>(),
            dispatched
                .iter()
                .map(|e| e.uri.as_str())
                .collect::<Vec<_>>(),
        );
    }

    #[test]
    fn neighborhood_entries_for_saved_returns_empty_for_fresh_state() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let entries = neighborhood_entries_for("network:///saved", &state);

        // Fresh AppState has no saved profiles, so the list should be empty
        // (we do not seed the placeholder for the saved branch).
        assert!(entries.is_empty());
    }

    #[test]
    fn command_output_with_timeout_returns_quick_command_output() {
        let mut cmd = std::process::Command::new("echo");
        cmd.arg("hello");

        let output = command_output_with_timeout(cmd, std::time::Duration::from_secs(2));

        assert_eq!(output.as_deref().map(str::trim), Some("hello"));
    }

    #[test]
    fn command_output_with_timeout_kills_long_running_command() {
        let mut cmd = std::process::Command::new("sleep");
        cmd.arg("5");
        let started = std::time::Instant::now();

        let _ = command_output_with_timeout(cmd, std::time::Duration::from_millis(120));

        // We should not have actually waited five seconds — the child was killed.
        assert!(
            started.elapsed() < std::time::Duration::from_secs(2),
            "elapsed={:?}",
            started.elapsed()
        );
    }

    #[test]
    fn local_uri_for_path_round_trips() {
        let dir = tempdir().unwrap();
        let uri = local_uri_for_path(dir.path()).unwrap();

        assert!(uri.starts_with("local://"));
        let parsed = ResourceUri::parse(&uri).unwrap();
        assert_eq!(parsed.scheme(), "local");
    }
}
