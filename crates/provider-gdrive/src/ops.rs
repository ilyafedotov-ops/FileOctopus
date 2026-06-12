use chrono::{DateTime, Utc};
use vfs::{EntryCapabilities, FileEntry, FileKind, ProviderId, ResourceUri};

pub fn gdrive_file_to_entry(item: &serde_json::Value) -> Option<FileEntry> {
    let name = item.get("name")?.as_str()?.to_string();
    let id = item.get("id")?.as_str()?.to_string();
    let mime_type = item.get("mimeType").and_then(|v| v.as_str()).unwrap_or("");
    let kind = if mime_type == "application/vnd.google-apps.folder" {
        FileKind::Directory
    } else {
        FileKind::File
    };

    let size = item
        .get("size")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let modified_time = item
        .get("modifiedTime")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone::<Utc>(&Utc));

    let owner = item
        .get("owners")
        .and_then(|o| o.get(0))
        .and_then(|o| o.get("emailAddress"))
        .and_then(|e| e.as_str())
        .map(|s| s.to_string());

    Some(FileEntry {
        uri: ResourceUri::parse(&format!("gdrive://profile/{}", id)).ok()?,
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
        provider_id: ProviderId::new("gdrive"),
        capabilities: if kind == FileKind::Directory {
            EntryCapabilities::read_only_directory()
        } else {
            EntryCapabilities::read_only_file()
        },
        permissions: None,
        owner,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gdrive_file_to_entry_parses_file() {
        let json = serde_json::json!({
            "name": "document.txt",
            "id": "1abc123",
            "mimeType": "text/plain",
            "size": "1024",
            "modifiedTime": "2025-01-15T10:30:00.000Z"
        });
        let entry = gdrive_file_to_entry(&json).unwrap();
        assert_eq!(entry.name, "document.txt");
        assert_eq!(entry.kind, FileKind::File);
        assert_eq!(entry.size, Some(1024));
        assert_eq!(entry.provider_id.as_str(), "gdrive");
    }

    #[test]
    fn gdrive_file_to_entry_parses_folder() {
        let json = serde_json::json!({
            "name": "My Folder",
            "id": "folder123",
            "mimeType": "application/vnd.google-apps.folder"
        });
        let entry = gdrive_file_to_entry(&json).unwrap();
        assert_eq!(entry.name, "My Folder");
        assert_eq!(entry.kind, FileKind::Directory);
        assert_eq!(entry.size, None);
    }

    #[test]
    fn gdrive_file_to_entry_returns_none_without_name() {
        let json = serde_json::json!({
            "id": "1abc123"
        });
        assert!(gdrive_file_to_entry(&json).is_none());
    }
}
