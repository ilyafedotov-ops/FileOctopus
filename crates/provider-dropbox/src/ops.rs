use chrono::{DateTime, Utc};
use vfs::{EntryCapabilities, FileEntry, FileKind, ProviderId, ResourceUri};

pub fn dropbox_metadata_to_entry(profile_id: &str, item: &serde_json::Value) -> Option<FileEntry> {
    let name = item.get("name")?.as_str()?.to_string();
    let tag = item.get(".tag").and_then(|v| v.as_str()).unwrap_or("file");
    let kind = if tag == "folder" {
        FileKind::Directory
    } else {
        FileKind::File
    };

    let size = item.get("size").and_then(|v| v.as_u64()).unwrap_or(0);

    let modified_time = item
        .get("client_modified")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone::<Utc>(&Utc));

    let path_lower = item
        .get("path_lower")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    Some(FileEntry {
        uri: ResourceUri::from_remote_profile("dropbox", profile_id, path_lower).ok()?,
        name,
        extension: None,
        kind,
        size: if kind == FileKind::Directory {
            None
        } else {
            Some(size)
        },
        modified_at: modified_time,
        created_at: None,
        accessed_at: None,
        is_hidden: false,
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: ProviderId::new("dropbox"),
        capabilities: if kind == FileKind::Directory {
            EntryCapabilities::read_only_directory()
        } else {
            EntryCapabilities::read_only_file()
        },
        permissions: None,
        owner: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROFILE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

    #[test]
    fn dropbox_metadata_to_entry_parses_file() {
        let json = serde_json::json!({
            ".tag": "file",
            "name": "photo.jpg",
            "path_lower": "/photos/photo.jpg",
            "size": 2048,
            "client_modified": "2025-03-20T14:00:00Z"
        });
        let entry = dropbox_metadata_to_entry(PROFILE_ID, &json).unwrap();
        assert_eq!(entry.name, "photo.jpg");
        assert_eq!(entry.kind, FileKind::File);
        assert_eq!(entry.size, Some(2048));
        assert_eq!(entry.provider_id.as_str(), "dropbox");
    }

    #[test]
    fn dropbox_metadata_to_entry_parses_folder() {
        let json = serde_json::json!({
            ".tag": "folder",
            "name": "Photos",
            "path_lower": "/photos"
        });
        let entry = dropbox_metadata_to_entry(PROFILE_ID, &json).unwrap();
        assert_eq!(entry.name, "Photos");
        assert_eq!(entry.kind, FileKind::Directory);
        assert_eq!(entry.size, None);
    }
}
