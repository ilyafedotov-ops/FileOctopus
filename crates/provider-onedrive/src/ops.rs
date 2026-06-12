use chrono::{DateTime, Utc};
use vfs::{EntryCapabilities, FileEntry, FileKind, ProviderId, ResourceUri};

pub fn onedrive_item_to_entry(item: &serde_json::Value) -> Option<FileEntry> {
    let name = item.get("name")?.as_str()?.to_string();
    let folder = item.get("folder").is_some();
    let kind = if folder {
        FileKind::Directory
    } else {
        FileKind::File
    };

    let size = item.get("size").and_then(|v| v.as_u64()).unwrap_or(0);

    let modified_time = item
        .get("lastModifiedDateTime")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone::<Utc>(&Utc));

    let created_time = item
        .get("createdDateTime")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone::<Utc>(&Utc));

    let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");

    let owner = item
        .get("createdBy")
        .and_then(|c| c.get("user"))
        .and_then(|u| u.get("displayName"))
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());

    Some(FileEntry {
        uri: ResourceUri::parse(&format!("onedrive://profile/{}", id)).ok()?,
        name,
        extension: None,
        kind,
        size: if folder { None } else { Some(size) },
        modified_at: modified_time,
        created_at: created_time,
        accessed_at: None,
        is_hidden: false,
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: ProviderId::new("onedrive"),
        capabilities: if folder {
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
    fn onedrive_item_to_entry_parses_file() {
        let json = serde_json::json!({
            "id": "abc123",
            "name": "report.docx",
            "size": 4096,
            "lastModifiedDateTime": "2025-06-10T08:00:00Z",
            "createdDateTime": "2025-06-01T12:00:00Z"
        });
        let entry = onedrive_item_to_entry(&json).unwrap();
        assert_eq!(entry.name, "report.docx");
        assert_eq!(entry.kind, FileKind::File);
        assert_eq!(entry.size, Some(4096));
        assert!(entry.created_at.is_some());
        assert_eq!(entry.provider_id.as_str(), "onedrive");
    }

    #[test]
    fn onedrive_item_to_entry_parses_folder() {
        let json = serde_json::json!({
            "id": "folder456",
            "name": "Documents",
            "folder": { "childCount": 5 }
        });
        let entry = onedrive_item_to_entry(&json).unwrap();
        assert_eq!(entry.name, "Documents");
        assert_eq!(entry.kind, FileKind::Directory);
        assert_eq!(entry.size, None);
    }
}
