use std::collections::HashSet;
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "macos", test))]
use std::process::{Command, Stdio};
#[cfg(any(target_os = "macos", test))]
use std::time::{Duration, Instant};

use vfs::{FileKind, ResourceUri};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NeighborhoodEntry {
    pub uri: String,
    pub name: String,
    pub kind: FileKind,
    pub target_uri: Option<String>,
    pub virtual_kind: String,
    pub protocol: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
}

pub fn group_entries() -> Vec<NeighborhoodEntry> {
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

pub fn cloud_entries() -> Vec<NeighborhoodEntry> {
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

pub fn lan_entries() -> Vec<NeighborhoodEntry> {
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

#[allow(clippy::too_many_arguments)]
pub fn virtual_entry(
    uri: impl Into<String>,
    name: impl Into<String>,
    kind: FileKind,
    target_uri: Option<String>,
    virtual_kind: impl Into<String>,
    protocol: Option<&str>,
    status: Option<&str>,
    description: Option<String>,
) -> NeighborhoodEntry {
    NeighborhoodEntry {
        uri: uri.into(),
        name: name.into(),
        kind,
        target_uri,
        virtual_kind: virtual_kind.into(),
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

fn discover_lan_entries() -> Vec<NeighborhoodEntry> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

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

        assert_eq!(dir.virtual_kind, "group");
        assert_eq!(dir.kind, FileKind::Directory);
        assert_eq!(action.kind, FileKind::Virtual);
    }

    #[test]
    fn virtual_entry_sets_target_when_target_present() {
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

        assert_eq!(
            entry.target_uri.as_deref(),
            Some("local:///Users/me/iCloud")
        );
    }

    #[test]
    fn group_entries_returns_four_groups_with_expected_uris() {
        let entries = group_entries();
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
        assert_eq!(
            entries[0..3]
                .iter()
                .map(|entry| entry.virtual_kind.as_str())
                .collect::<Vec<_>>(),
            vec!["group", "group", "group"]
        );
        assert_eq!(entries[3].virtual_kind, "addConnection");
        assert_eq!(entries[3].kind, FileKind::Virtual);
    }

    #[test]
    fn lan_entries_is_never_empty() {
        let entries = lan_entries();
        assert!(!entries.is_empty());

        for entry in &entries {
            assert!(entry.uri.starts_with("network:///lan"));
            if entry.virtual_kind == "empty" {
                assert_eq!(entry.uri, "network:///lan/empty");
                assert_eq!(entry.kind, FileKind::Virtual);
                assert_eq!(entry.status.as_deref(), Some("unavailable"));
            } else {
                assert_eq!(entry.virtual_kind, "discoveredService");
                assert_eq!(entry.kind, FileKind::Directory);
                assert!(entry.protocol.is_some());
                assert_eq!(entry.status.as_deref(), Some("credentialsRequired"));
            }
        }
    }

    #[test]
    fn command_output_with_timeout_returns_quick_command_output() {
        let mut cmd = Command::new("echo");
        cmd.arg("hello");

        let output = command_output_with_timeout(cmd, Duration::from_secs(2));

        assert_eq!(output.as_deref().map(str::trim), Some("hello"));
    }

    #[test]
    fn command_output_with_timeout_kills_long_running_command() {
        let mut cmd = Command::new("sleep");
        cmd.arg("5");
        let started = Instant::now();

        let _ = command_output_with_timeout(cmd, Duration::from_millis(120));

        assert!(started.elapsed() < Duration::from_secs(2));
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
