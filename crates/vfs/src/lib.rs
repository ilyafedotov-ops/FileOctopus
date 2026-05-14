use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ResourceUri(String);

impl ResourceUri {
    pub fn parse(input: &str) -> Result<Self, VfsError> {
        let (scheme, body) = input
            .split_once("://")
            .ok_or_else(|| VfsError::invalid_uri(input, "missing URI scheme separator"))?;

        if scheme != "local" {
            return Err(VfsError::UnsupportedProvider {
                scheme: scheme.to_string(),
            });
        }

        if !is_valid_local_uri_body(body) {
            return Err(VfsError::invalid_uri(input, "invalid local URI path"));
        }

        Ok(Self(input.to_string()))
    }

    pub fn from_local_path(path: &Path) -> Result<Self, VfsError> {
        let normalized = path.to_string_lossy().replace('\\', "/");

        if normalized.starts_with('/') {
            return Ok(Self(format!("local://{normalized}")));
        }

        if has_windows_drive_prefix(&normalized) {
            return Ok(Self(format!("local://{normalized}")));
        }

        Err(VfsError::invalid_uri(
            &normalized,
            "local path must be absolute",
        ))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn scheme(&self) -> &str {
        self.0.split_once("://").map_or("", |(scheme, _)| scheme)
    }

    pub fn display_path(&self) -> String {
        self.0
            .strip_prefix("local://")
            .unwrap_or(self.0.as_str())
            .to_string()
    }

    pub fn to_local_path(&self) -> Result<PathBuf, VfsError> {
        if self.scheme() != "local" {
            return Err(VfsError::UnsupportedProvider {
                scheme: self.scheme().to_string(),
            });
        }

        Ok(PathBuf::from(self.display_path()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProviderId(String);

impl ProviderId {
    pub fn new(value: &str) -> Self {
        Self(value.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ListSessionId(String);

impl ListSessionId {
    pub fn new(value: &str) -> Self {
        Self(value.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileEntry {
    pub uri: ResourceUri,
    pub name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<ResourceUri>,
    pub provider_id: ProviderId,
    pub capabilities: EntryCapabilities,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    File,
    Directory,
    Symlink,
    Archive,
    Virtual,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryCapabilities {
    pub can_read: bool,
    pub can_list: bool,
    pub can_write: bool,
    pub can_delete: bool,
    pub can_rename: bool,
}

impl EntryCapabilities {
    pub fn read_only_file() -> Self {
        Self {
            can_read: true,
            can_list: false,
            can_write: false,
            can_delete: false,
            can_rename: false,
        }
    }

    pub fn read_only_directory() -> Self {
        Self {
            can_read: false,
            can_list: true,
            can_write: false,
            can_delete: false,
            can_rename: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapabilities {
    pub can_stat: bool,
    pub can_list: bool,
    pub can_read: bool,
    pub can_write: bool,
    pub can_delete: bool,
}

impl ProviderCapabilities {
    pub fn read_only() -> Self {
        Self {
            can_stat: true,
            can_list: true,
            can_read: true,
            can_write: false,
            can_delete: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListOptions {
    pub session_id: ListSessionId,
    pub batch_size: usize,
    pub include_hidden: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryBatch {
    pub session_id: ListSessionId,
    pub uri: ResourceUri,
    pub entries: Vec<FileEntry>,
    pub batch_index: u64,
    pub is_complete: bool,
    pub total_hint: Option<u64>,
}

pub type DirectorySink = tokio::sync::mpsc::Sender<DirectoryBatch>;

#[async_trait::async_trait]
pub trait VfsProvider: Send + Sync {
    fn id(&self) -> ProviderId;
    fn schemes(&self) -> &'static [&'static str];
    fn capabilities(&self) -> ProviderCapabilities;
    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;
    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VfsError {
    InvalidUri { uri: String, reason: String },
    UnsupportedProvider { scheme: String },
    Internal { message: String },
}

impl VfsError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidUri { .. } => "invalid_uri",
            Self::UnsupportedProvider { .. } => "unsupported_provider",
            Self::Internal { .. } => "internal",
        }
    }

    fn invalid_uri(uri: &str, reason: &str) -> Self {
        Self::InvalidUri {
            uri: uri.to_string(),
            reason: reason.to_string(),
        }
    }

    pub fn internal(message: &str) -> Self {
        Self::Internal {
            message: message.to_string(),
        }
    }
}

impl fmt::Display for VfsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidUri { uri, reason } => {
                write!(formatter, "invalid URI `{uri}`: {reason}")
            }
            Self::UnsupportedProvider { scheme } => {
                write!(formatter, "unsupported provider scheme `{scheme}`")
            }
            Self::Internal { message } => write!(formatter, "{message}"),
        }
    }
}

impl Error for VfsError {}

fn is_valid_local_uri_body(body: &str) -> bool {
    if body.is_empty() || body.contains('\0') {
        return false;
    }

    body.starts_with('/') || has_windows_drive_prefix(body)
}

fn has_windows_drive_prefix(value: &str) -> bool {
    let bytes = value.as_bytes();

    bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'/'
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn parses_unix_local_uri() {
        let uri = ResourceUri::parse("local:///Users/ilya/Documents").unwrap();

        assert_eq!(uri.as_str(), "local:///Users/ilya/Documents");
        assert_eq!(uri.scheme(), "local");
        assert_eq!(uri.display_path(), "/Users/ilya/Documents");
        assert_eq!(
            uri.to_local_path().unwrap(),
            Path::new("/Users/ilya/Documents")
        );
    }

    #[test]
    fn parses_windows_local_uri() {
        let uri = ResourceUri::parse("local://C:/Users/Ilya/Documents").unwrap();

        assert_eq!(uri.as_str(), "local://C:/Users/Ilya/Documents");
        assert_eq!(uri.scheme(), "local");
        assert_eq!(uri.display_path(), "C:/Users/Ilya/Documents");
        assert_eq!(
            uri.to_local_path().unwrap().to_string_lossy(),
            "C:/Users/Ilya/Documents"
        );
    }

    #[test]
    fn creates_local_uri_from_unix_path() {
        let uri = ResourceUri::from_local_path(Path::new("/Users/ilya/Documents")).unwrap();

        assert_eq!(uri.as_str(), "local:///Users/ilya/Documents");
    }

    #[test]
    fn creates_local_uri_from_windows_path() {
        let uri = ResourceUri::from_local_path(Path::new("C:\\Users\\Ilya\\Documents")).unwrap();

        assert_eq!(uri.as_str(), "local://C:/Users/Ilya/Documents");
    }

    #[test]
    fn rejects_invalid_scheme() {
        let error = ResourceUri::parse("sftp:///Users/ilya").unwrap_err();

        assert_eq!(error.code(), "unsupported_provider");
    }

    #[test]
    fn rejects_relative_local_uri() {
        let error = ResourceUri::parse("local://Users/ilya/Documents").unwrap_err();

        assert_eq!(error.code(), "invalid_uri");
    }

    #[test]
    fn rejects_relative_platform_path() {
        let error = ResourceUri::from_local_path(Path::new("relative/path")).unwrap_err();

        assert_eq!(error.code(), "invalid_uri");
    }

    #[test]
    fn serializes_file_entry_for_ipc() {
        let entry = FileEntry {
            uri: ResourceUri::parse("local:///Users/ilya/file.txt").unwrap(),
            name: "file.txt".to_string(),
            extension: Some("txt".to_string()),
            kind: FileKind::File,
            size: Some(1024),
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            symlink_target: None,
            provider_id: ProviderId::new("local"),
            capabilities: EntryCapabilities::read_only_file(),
        };

        let encoded = serde_json::to_string(&entry).unwrap();
        let decoded: FileEntry = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.uri.as_str(), "local:///Users/ilya/file.txt");
        assert_eq!(decoded.kind, FileKind::File);
        assert!(decoded.capabilities.can_read);
        assert!(!decoded.capabilities.can_list);
    }

    #[test]
    fn serializes_directory_batch_for_ipc() {
        let batch = DirectoryBatch {
            session_id: ListSessionId::new("session-1"),
            uri: ResourceUri::parse("local:///Users/ilya").unwrap(),
            entries: Vec::new(),
            batch_index: 0,
            is_complete: true,
            total_hint: Some(0),
        };

        let encoded = serde_json::to_string(&batch).unwrap();
        let decoded: DirectoryBatch = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.session_id.as_str(), "session-1");
        assert!(decoded.is_complete);
        assert_eq!(decoded.total_hint, Some(0));
    }

    struct TestProvider;

    #[async_trait::async_trait]
    impl VfsProvider for TestProvider {
        fn id(&self) -> ProviderId {
            ProviderId::new("test")
        }

        fn schemes(&self) -> &'static [&'static str] {
            &["local"]
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities::read_only()
        }

        async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
            Ok(FileEntry {
                uri: uri.clone(),
                name: "Users".to_string(),
                extension: None,
                kind: FileKind::Directory,
                size: None,
                modified_at: None,
                created_at: None,
                accessed_at: None,
                is_hidden: false,
                is_symlink: false,
                symlink_target: None,
                provider_id: self.id(),
                capabilities: EntryCapabilities::read_only_directory(),
            })
        }

        async fn list(
            &self,
            uri: &ResourceUri,
            options: ListOptions,
            sink: DirectorySink,
        ) -> Result<(), VfsError> {
            sink.send(DirectoryBatch {
                session_id: options.session_id,
                uri: uri.clone(),
                entries: Vec::new(),
                batch_index: 0,
                is_complete: true,
                total_hint: Some(0),
            })
            .await
            .map_err(|_| VfsError::internal("directory sink closed"))
        }
    }

    #[tokio::test]
    async fn provider_trait_supports_async_stat_and_streamed_list() {
        let provider = TestProvider;
        let uri = ResourceUri::parse("local:///Users").unwrap();
        let entry = provider.stat(&uri).await.unwrap();
        let (sender, mut receiver) = tokio::sync::mpsc::channel(1);

        provider
            .list(
                &uri,
                ListOptions {
                    session_id: ListSessionId::new("session-1"),
                    batch_size: 100,
                    include_hidden: false,
                },
                sender,
            )
            .await
            .unwrap();

        let batch = receiver.recv().await.unwrap();

        assert_eq!(provider.id().as_str(), "test");
        assert_eq!(provider.schemes(), &["local"]);
        assert_eq!(entry.kind, FileKind::Directory);
        assert!(batch.is_complete);
    }
}
