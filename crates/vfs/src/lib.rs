use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ResourceUri(String);

pub const REMOTE_SCHEMES: &[&str] = &["sftp"];

impl ResourceUri {
    pub fn parse(input: &str) -> Result<Self, VfsError> {
        let (scheme, body) = input
            .split_once("://")
            .ok_or_else(|| VfsError::invalid_uri(input, "missing URI scheme separator"))?;

        match scheme {
            "local" => {
                if !is_valid_local_uri_body(body) {
                    return Err(VfsError::invalid_uri(input, "invalid local URI path"));
                }
            }
            scheme if REMOTE_SCHEMES.contains(&scheme) => {
                validate_remote_uri_body(scheme, body, input)?;
            }
            _ => {
                return Err(VfsError::UnsupportedProvider {
                    scheme: scheme.to_string(),
                });
            }
        }

        Ok(Self(input.to_string()))
    }

    pub fn is_remote(&self) -> bool {
        REMOTE_SCHEMES.contains(&self.scheme())
    }

    pub fn from_remote_profile(
        scheme: &str,
        profile_id: &str,
        path: &str,
    ) -> Result<Self, VfsError> {
        if !REMOTE_SCHEMES.contains(&scheme) {
            return Err(VfsError::UnsupportedProvider {
                scheme: scheme.to_string(),
            });
        }

        if !is_valid_uuid(profile_id) {
            return Err(VfsError::invalid_uri(
                profile_id,
                "remote profile id must be a UUID",
            ));
        }

        let normalized_path = normalize_remote_path(path);
        Self::parse(&format!("{scheme}://{profile_id}{normalized_path}"))
    }

    pub fn remote_authority(&self) -> Option<&str> {
        if self.scheme() == "local" {
            return None;
        }

        let body = self.0.split_once("://")?.1;
        body.split('/').next().filter(|value| !value.is_empty())
    }

    pub fn remote_path(&self) -> Option<String> {
        if self.scheme() == "local" {
            return None;
        }

        let body = self.0.split_once("://")?.1;
        let path = match body.split_once('/') {
            Some((_, rest)) if !rest.is_empty() => format!("/{rest}"),
            Some(_) => "/".to_string(),
            None => "/".to_string(),
        };

        Some(path)
    }

    #[cfg(test)]
    fn unchecked(input: &str) -> Self {
        Self(input.to_string())
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
        if self.scheme() == "local" {
            return self
                .0
                .strip_prefix("local://")
                .unwrap_or(self.0.as_str())
                .to_string();
        }

        self.remote_path().unwrap_or_else(|| self.0.clone())
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
    pub permissions: Option<String>,
    pub owner: Option<String>,
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

    pub fn writable_file() -> Self {
        Self {
            can_read: true,
            can_list: false,
            can_write: true,
            can_delete: true,
            can_rename: true,
        }
    }

    pub fn writable_directory() -> Self {
        Self {
            can_read: false,
            can_list: true,
            can_write: true,
            can_delete: true,
            can_rename: true,
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

    pub fn read_write() -> Self {
        Self {
            can_stat: true,
            can_list: true,
            can_read: true,
            can_write: true,
            can_delete: true,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct ListCancellation {
    cancelled: Arc<AtomicBool>,
}

impl ListCancellation {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListOptions {
    pub session_id: ListSessionId,
    pub request_id: String,
    pub batch_size: usize,
    pub include_hidden: bool,
    #[serde(skip, default)]
    pub cancel: ListCancellation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryBatch {
    pub session_id: ListSessionId,
    pub request_id: String,
    pub uri: ResourceUri,
    pub entries: Vec<FileEntry>,
    pub batch_index: u64,
    pub is_complete: bool,
    pub total_hint: Option<u64>,
}

pub type DirectorySink = tokio::sync::mpsc::Sender<DirectoryBatch>;

/// File operation supported by the local operation pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationKind {
    Copy,
    Move,
    Rename,
    DeleteToTrash,
    CreateDirectory,
    CreateFile,
    WriteTextFile,
    DeletePermanently,
    CreateArchive,
    ExtractArchive,
    FolderSize,
    RecursiveSearch,
}

/// Conflict behavior selected before an operation mutates the filesystem.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictPolicy {
    Fail,
    Skip,
    Overwrite,
    RenameNew,
    RenameExisting,
}

/// Backend-neutral request to plan or execute a file operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationRequest {
    pub kind: FileOperationKind,
    pub sources: Vec<ResourceUri>,
    pub destination: Option<ResourceUri>,
    pub new_name: Option<String>,
    pub conflict_policy: ConflictPolicy,
}

/// Deterministic result produced by validating a requested operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationPlan {
    pub operation_id: String,
    pub kind: FileOperationKind,
    pub sources: Vec<ResourceUri>,
    pub destination: Option<ResourceUri>,
    pub new_name: Option<String>,
    pub conflict_policy: ConflictPolicy,
    pub items: Vec<FileOperationItem>,
    pub conflicts: Vec<FileOperationConflict>,
    pub warnings: Vec<FileOperationWarning>,
    pub total_items: u64,
    pub total_bytes: Option<u64>,
}

/// Single filesystem item included in an operation plan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationItem {
    pub source: Option<ResourceUri>,
    pub destination: Option<ResourceUri>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub recursive: bool,
}

/// Destination conflict detected before operation execution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationConflict {
    pub source: ResourceUri,
    pub destination: ResourceUri,
}

pub mod file_operation_warning_codes {
    pub const METADATA_FAILED: &str = "metadata_failed";

    pub const ALL: &[&str] = &[METADATA_FAILED];
}

/// Non-fatal planner diagnostic for incomplete metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationWarning {
    pub code: String,
    pub message: String,
    pub uri: Option<ResourceUri>,
}

impl FileOperationWarning {
    pub fn new(code: &'static str, message: impl Into<String>, uri: Option<ResourceUri>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            uri,
        }
    }

    pub fn metadata_failed(message: impl Into<String>, uri: ResourceUri) -> Self {
        Self::new(
            file_operation_warning_codes::METADATA_FAILED,
            message,
            Some(uri),
        )
    }
}

/// Stable file operation error taxonomy shared by planning, execution, and IPC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum FileOperationError {
    InvalidRequest { message: String },
    InvalidName { name: String },
    InvalidPath { uri: String, message: String },
    UnsupportedProvider { scheme: String },
    NotFound { uri: String },
    PermissionDenied { uri: String },
    DestinationMissing { uri: String },
    DestinationConflict { uri: String },
    RecursiveOperation { message: String },
    UnsupportedSymlink { uri: String, message: String },
    UnsupportedTrash { message: String },
    Cancelled { job_id: Option<String> },
    Timeout { message: String },
    Io { message: String },
    Internal { message: String },
}

impl FileOperationError {
    pub fn io(message: impl Into<String>) -> Self {
        Self::Io {
            message: message.into(),
        }
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self::Timeout {
            message: message.into(),
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidRequest { .. } => "invalid_request",
            Self::InvalidName { .. } => "invalid_name",
            Self::InvalidPath { .. } => "invalid_path",
            Self::UnsupportedProvider { .. } => "unsupported_provider",
            Self::NotFound { .. } => "not_found",
            Self::PermissionDenied { .. } => "permission_denied",
            Self::DestinationMissing { .. } => "destination_missing",
            Self::DestinationConflict { .. } => "destination_conflict",
            Self::RecursiveOperation { .. } => "recursive_operation",
            Self::UnsupportedSymlink { .. } => "unsupported_symlink",
            Self::UnsupportedTrash { .. } => "unsupported_trash",
            Self::Cancelled { .. } => "cancelled",
            Self::Timeout { .. } => "timeout",
            Self::Io { .. } => "io_error",
            Self::Internal { .. } => "internal",
        }
    }

    pub fn user_message(&self) -> String {
        match self {
            Self::InvalidRequest { message }
            | Self::InvalidPath { message, .. }
            | Self::RecursiveOperation { message }
            | Self::UnsupportedSymlink { message, .. }
            | Self::UnsupportedTrash { message }
            | Self::Timeout { message }
            | Self::Io { message }
            | Self::Internal { message } => message.clone(),
            Self::InvalidName { name } => format!("invalid file name `{name}`"),
            Self::UnsupportedProvider { scheme } => {
                format!("unsupported provider scheme `{scheme}`")
            }
            Self::NotFound { uri } => format!("resource not found `{uri}`"),
            Self::PermissionDenied { uri } => format!("permission denied `{uri}`"),
            Self::DestinationMissing { uri } => format!("destination parent missing `{uri}`"),
            Self::DestinationConflict { uri } => format!("destination already exists `{uri}`"),
            Self::Cancelled { .. } => "operation cancelled".to_string(),
        }
    }
}

impl fmt::Display for FileOperationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.user_message())
    }
}

impl Error for FileOperationError {}

impl From<VfsError> for FileOperationError {
    fn from(error: VfsError) -> Self {
        match error {
            VfsError::InvalidUri { uri, reason } => Self::InvalidPath {
                uri,
                message: reason,
            },
            VfsError::UnsupportedProvider { scheme } => Self::UnsupportedProvider { scheme },
            VfsError::UnsupportedOperation {
                scheme,
                operation: _,
            } => Self::UnsupportedProvider { scheme },
            VfsError::NotFound { uri } => Self::NotFound { uri },
            VfsError::PermissionDenied { uri } => Self::PermissionDenied { uri },
            VfsError::Timeout { uri } => {
                Self::timeout(format!("Directory listing timed out for `{uri}`"))
            }
            VfsError::Cancelled { .. } => Self::Cancelled { job_id: None },
            VfsError::DuplicateProvider { scheme } => Self::Internal {
                message: format!("duplicate provider scheme `{scheme}`"),
            },
            VfsError::Internal { message } => Self::Internal { message },
            VfsError::DeviceUnavailable { uri } => Self::PermissionDenied { uri },
            VfsError::ConnectionRequired { uri } => Self::InvalidPath {
                uri,
                message: "connection required".to_string(),
            },
            VfsError::AuthenticationFailed { uri, message } => Self::PermissionDenied {
                uri: format!("{uri}: {message}"),
            },
            VfsError::ConnectionLost { uri, message } => Self::Io {
                message: format!("connection lost for `{uri}`: {message}"),
            },
        }
    }
}

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

    async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let _ = uri;
        Err(self.unsupported_operation("create_directory"))
    }

    async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
        let _ = uri;
        Err(self.unsupported_operation("create_file"))
    }

    async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
        let _ = (from, to);
        Err(self.unsupported_operation("rename"))
    }

    async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
        let _ = (uri, recursive);
        Err(self.unsupported_operation("remove"))
    }

    async fn copy_file(
        &self,
        source: &ResourceUri,
        destination: &ResourceUri,
        on_progress: Box<dyn FnMut(u64) + Send>,
    ) -> Result<u64, VfsError> {
        let _ = (source, destination, on_progress);
        Err(self.unsupported_operation("copy_file"))
    }

    async fn read_file_prefix(
        &self,
        uri: &ResourceUri,
        max_bytes: u64,
    ) -> Result<Vec<u8>, VfsError> {
        let _ = (uri, max_bytes);
        Err(self.unsupported_operation("read_file_prefix"))
    }

    #[doc(hidden)]
    fn unsupported_operation(&self, operation: &'static str) -> VfsError {
        VfsError::UnsupportedOperation {
            scheme: self
                .schemes()
                .first()
                .copied()
                .unwrap_or("unknown")
                .to_string(),
            operation,
        }
    }
}

pub struct VfsRegistry {
    providers_by_scheme: RwLock<std::collections::HashMap<String, Arc<dyn VfsProvider>>>,
}

impl VfsRegistry {
    pub fn new() -> Self {
        Self {
            providers_by_scheme: RwLock::new(std::collections::HashMap::new()),
        }
    }

    pub fn register(&self, provider: Arc<dyn VfsProvider>) -> Result<(), VfsError> {
        let mut providers = self
            .providers_by_scheme
            .write()
            .map_err(|_| VfsError::internal("provider registry lock poisoned"))?;

        for scheme in provider.schemes() {
            if providers.contains_key(*scheme) {
                return Err(VfsError::DuplicateProvider {
                    scheme: (*scheme).to_string(),
                });
            }
        }

        for scheme in provider.schemes() {
            providers.insert((*scheme).to_string(), provider.clone());
        }

        Ok(())
    }

    pub fn provider_for(&self, uri: &ResourceUri) -> Result<Arc<dyn VfsProvider>, VfsError> {
        let providers = self
            .providers_by_scheme
            .read()
            .map_err(|_| VfsError::internal("provider registry lock poisoned"))?;

        providers
            .get(uri.scheme())
            .cloned()
            .ok_or_else(|| VfsError::UnsupportedProvider {
                scheme: uri.scheme().to_string(),
            })
    }

    pub async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
        self.provider_for(uri)?.stat(uri).await
    }

    pub async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        self.provider_for(uri)?.list(uri, options, sink).await
    }
}

impl Default for VfsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VfsError {
    InvalidUri {
        uri: String,
        reason: String,
    },
    UnsupportedProvider {
        scheme: String,
    },
    UnsupportedOperation {
        scheme: String,
        operation: &'static str,
    },
    DuplicateProvider {
        scheme: String,
    },
    NotFound {
        uri: String,
    },
    PermissionDenied {
        uri: String,
    },
    Timeout {
        uri: String,
    },
    Cancelled {
        uri: String,
    },
    DeviceUnavailable {
        uri: String,
    },
    ConnectionRequired {
        uri: String,
    },
    AuthenticationFailed {
        uri: String,
        message: String,
    },
    ConnectionLost {
        uri: String,
        message: String,
    },
    Internal {
        message: String,
    },
}

impl VfsError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidUri { .. } => "invalid_uri",
            Self::UnsupportedProvider { .. } => "unsupported_provider",
            Self::UnsupportedOperation { .. } => "unsupported_operation",
            Self::DuplicateProvider { .. } => "duplicate_provider",
            Self::NotFound { .. } => "not_found",
            Self::PermissionDenied { .. } => "permission_denied",
            Self::Timeout { .. } => "timeout",
            Self::Cancelled { .. } => "cancelled",
            Self::DeviceUnavailable { .. } => "device_unavailable",
            Self::ConnectionRequired { .. } => "connection_required",
            Self::AuthenticationFailed { .. } => "authentication_failed",
            Self::ConnectionLost { .. } => "connection_lost",
            Self::Internal { .. } => "internal",
        }
    }

    pub fn connection_required(uri: &ResourceUri) -> Self {
        Self::ConnectionRequired {
            uri: uri.as_str().to_string(),
        }
    }

    pub fn authentication_failed(uri: &ResourceUri, message: impl Into<String>) -> Self {
        Self::AuthenticationFailed {
            uri: uri.as_str().to_string(),
            message: message.into(),
        }
    }

    pub fn connection_lost(uri: &ResourceUri, message: impl Into<String>) -> Self {
        Self::ConnectionLost {
            uri: uri.as_str().to_string(),
            message: message.into(),
        }
    }

    pub fn invalid_uri(uri: &str, reason: &str) -> Self {
        Self::InvalidUri {
            uri: uri.to_string(),
            reason: reason.to_string(),
        }
    }

    pub fn not_found(uri: &ResourceUri) -> Self {
        Self::NotFound {
            uri: uri.as_str().to_string(),
        }
    }

    pub fn permission_denied(uri: &ResourceUri) -> Self {
        Self::PermissionDenied {
            uri: uri.as_str().to_string(),
        }
    }

    pub fn timeout(uri: &ResourceUri) -> Self {
        Self::Timeout {
            uri: uri.as_str().to_string(),
        }
    }

    pub fn cancelled(uri: &ResourceUri) -> Self {
        Self::Cancelled {
            uri: uri.as_str().to_string(),
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
            Self::DuplicateProvider { scheme } => {
                write!(formatter, "duplicate provider scheme `{scheme}`")
            }
            Self::NotFound { uri } => write!(formatter, "resource not found `{uri}`"),
            Self::PermissionDenied { uri } => write!(formatter, "permission denied `{uri}`"),
            Self::Timeout { uri } => write!(formatter, "directory listing timed out `{uri}`"),
            Self::Cancelled { uri } => write!(formatter, "directory listing cancelled `{uri}`"),
            Self::DeviceUnavailable { uri } => write!(formatter, "device unavailable `{uri}`"),
            Self::ConnectionRequired { uri } => write!(formatter, "connection required `{uri}`"),
            Self::AuthenticationFailed { uri, message } => {
                write!(formatter, "authentication failed `{uri}`: {message}")
            }
            Self::ConnectionLost { uri, message } => {
                write!(formatter, "connection lost `{uri}`: {message}")
            }
            Self::UnsupportedOperation { scheme, operation } => write!(
                formatter,
                "operation `{operation}` is not supported by scheme `{scheme}`"
            ),
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

fn validate_remote_uri_body(scheme: &str, body: &str, full: &str) -> Result<(), VfsError> {
    if body.is_empty() || body.contains('\0') {
        return Err(VfsError::invalid_uri(full, "missing remote URI authority"));
    }

    let authority = body
        .split('/')
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| VfsError::invalid_uri(full, "missing remote URI authority"))?;

    if scheme == "sftp" && !is_valid_uuid(authority) {
        return Err(VfsError::invalid_uri(
            full,
            "sftp authority must be a profile UUID",
        ));
    }

    if let Some(path) = body.strip_prefix(authority) {
        let remote_path = normalize_remote_path(path);
        if remote_path.split('/').any(|segment| segment == "..") {
            return Err(VfsError::invalid_uri(full, "path traversal not allowed"));
        }
    }

    Ok(())
}

fn normalize_remote_path(path: &str) -> String {
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }

    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    }
}

fn is_valid_uuid(value: &str) -> bool {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() != 5 {
        return false;
    }

    let lengths = [8, 4, 4, 4, 12];
    parts
        .iter()
        .zip(lengths)
        .all(|(part, length)| part.len() == length && part.chars().all(|ch| ch.is_ascii_hexdigit()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::path::Path;
    use std::sync::Arc;

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
    fn parses_sftp_profile_uri() {
        let uri =
            ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/home/user/Documents")
                .unwrap();

        assert_eq!(uri.scheme(), "sftp");
        assert_eq!(
            uri.remote_authority(),
            Some("550e8400-e29b-41d4-a716-446655440000")
        );
        assert_eq!(uri.remote_path(), Some("/home/user/Documents".to_string()));
        assert_eq!(uri.display_path(), "/home/user/Documents");
        assert!(uri.is_remote());
    }

    #[test]
    fn builds_sftp_uri_from_profile() {
        let uri = ResourceUri::from_remote_profile(
            "sftp",
            "550e8400-e29b-41d4-a716-446655440000",
            "/home/user",
        )
        .unwrap();

        assert_eq!(
            uri.as_str(),
            "sftp://550e8400-e29b-41d4-a716-446655440000/home/user"
        );
    }

    #[test]
    fn rejects_invalid_scheme() {
        let error = ResourceUri::parse("ftp:///Users/ilya").unwrap_err();

        assert_eq!(error.code(), "unsupported_provider");
    }

    #[test]
    fn rejects_unregistered_remote_scheme() {
        for scheme in ["smb", "webdav", "ftp"] {
            let uri = format!("{scheme}://550e8400-e29b-41d4-a716-446655440000/");
            let error = ResourceUri::parse(&uri).unwrap_err();
            assert_eq!(error.code(), "unsupported_provider", "scheme = {scheme}");
        }
    }

    #[test]
    fn rejects_invalid_sftp_authority() {
        let error = ResourceUri::parse("sftp://not-a-uuid/home").unwrap_err();

        assert_eq!(error.code(), "invalid_uri");
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
            permissions: None,
            owner: None,
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
            request_id: "request-1".to_string(),
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

    #[test]
    fn constructs_file_operation_model_for_each_kind() {
        let kinds = [
            FileOperationKind::Copy,
            FileOperationKind::Move,
            FileOperationKind::Rename,
            FileOperationKind::DeleteToTrash,
            FileOperationKind::CreateDirectory,
            FileOperationKind::CreateFile,
            FileOperationKind::WriteTextFile,
            FileOperationKind::DeletePermanently,
            FileOperationKind::CreateArchive,
            FileOperationKind::ExtractArchive,
        ];

        for kind in kinds {
            let request = FileOperationRequest {
                kind,
                sources: vec![ResourceUri::parse("local:///tmp/source.txt").unwrap()],
                destination: Some(ResourceUri::parse("local:///tmp/dest").unwrap()),
                new_name: Some("renamed.txt".to_string()),
                conflict_policy: ConflictPolicy::Fail,
            };
            let item = FileOperationItem {
                source: request.sources.first().cloned(),
                destination: request.destination.clone(),
                kind: FileKind::File,
                size: Some(1),
                recursive: false,
            };
            let plan = FileOperationPlan {
                operation_id: "operation-1".to_string(),
                kind,
                sources: request.sources,
                destination: request.destination,
                new_name: request.new_name,
                conflict_policy: request.conflict_policy,
                items: vec![item],
                conflicts: Vec::new(),
                warnings: Vec::new(),
                total_items: 1,
                total_bytes: Some(1),
            };

            assert_eq!(plan.kind, kind);
            assert_eq!(plan.total_items, 1);
        }
    }

    #[test]
    fn maps_vfs_error_to_file_operation_error() {
        let error = FileOperationError::from(VfsError::UnsupportedProvider {
            scheme: "sftp".to_string(),
        });

        assert_eq!(error.code(), "unsupported_provider");
    }

    #[test]
    fn maps_vfs_timeout_to_file_operation_timeout() {
        let uri = ResourceUri::parse("local:///tmp").unwrap();
        let error = FileOperationError::from(VfsError::timeout(&uri));

        assert_eq!(error.code(), "timeout");
        assert!(error.user_message().contains("timed out"));
    }

    #[test]
    fn file_operation_warning_catalog_has_unique_codes() {
        let unique = file_operation_warning_codes::ALL
            .iter()
            .copied()
            .collect::<HashSet<_>>();

        assert_eq!(unique.len(), file_operation_warning_codes::ALL.len());
    }

    #[test]
    fn metadata_failed_warning_uses_catalog_code() {
        let uri = ResourceUri::parse("local:///tmp/file.txt").unwrap();
        let warning = FileOperationWarning::metadata_failed("metadata missing", uri.clone());

        assert_eq!(warning.code, file_operation_warning_codes::METADATA_FAILED);
        assert_eq!(warning.uri, Some(uri));
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
                permissions: None,
                owner: None,
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
                request_id: options.request_id,
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
    async fn provider_create_directory_defaults_to_unsupported() {
        let provider = TestProvider;
        let uri = ResourceUri::parse("local:///tmp/x").unwrap();
        let error = provider
            .create_directory(&uri)
            .await
            .expect_err("default impl should return UnsupportedOperation");
        assert_eq!(error.code(), "unsupported_operation");
    }

    #[tokio::test]
    async fn provider_create_file_defaults_to_unsupported() {
        let provider = TestProvider;
        let uri = ResourceUri::parse("local:///tmp/x").unwrap();
        assert_eq!(
            provider.create_file(&uri).await.unwrap_err().code(),
            "unsupported_operation",
        );
    }

    #[tokio::test]
    async fn provider_rename_defaults_to_unsupported() {
        let provider = TestProvider;
        let from = ResourceUri::parse("local:///tmp/a").unwrap();
        let to = ResourceUri::parse("local:///tmp/b").unwrap();
        assert_eq!(
            provider.rename(&from, &to).await.unwrap_err().code(),
            "unsupported_operation",
        );
    }

    #[tokio::test]
    async fn provider_remove_defaults_to_unsupported() {
        let provider = TestProvider;
        let uri = ResourceUri::parse("local:///tmp/x").unwrap();
        assert_eq!(
            provider.remove(&uri, false).await.unwrap_err().code(),
            "unsupported_operation",
        );
    }

    #[tokio::test]
    async fn provider_copy_file_defaults_to_unsupported() {
        let provider = TestProvider;
        let from = ResourceUri::parse("local:///tmp/a").unwrap();
        let to = ResourceUri::parse("local:///tmp/b").unwrap();
        let result = provider.copy_file(&from, &to, Box::new(|_| {})).await;
        assert_eq!(result.unwrap_err().code(), "unsupported_operation");
    }

    #[tokio::test]
    async fn provider_read_file_prefix_defaults_to_unsupported() {
        let provider = TestProvider;
        let uri = ResourceUri::parse("local:///tmp/x").unwrap();
        assert_eq!(
            provider
                .read_file_prefix(&uri, 64)
                .await
                .unwrap_err()
                .code(),
            "unsupported_operation",
        );
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
                    request_id: "request-1".to_string(),
                    batch_size: 100,
                    include_hidden: false,
                    cancel: ListCancellation::new(),
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

    #[test]
    fn registry_returns_provider_for_uri_scheme() {
        let registry = VfsRegistry::new();

        registry.register(Arc::new(TestProvider)).unwrap();

        let uri = ResourceUri::parse("local:///Users").unwrap();
        let provider = registry.provider_for(&uri).unwrap();

        assert_eq!(provider.id().as_str(), "test");
    }

    #[test]
    fn registry_rejects_unknown_uri_scheme() {
        let registry = VfsRegistry::new();
        let uri = ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/").unwrap();
        let error = match registry.provider_for(&uri) {
            Ok(_) => panic!("expected unsupported provider error"),
            Err(error) => error,
        };

        assert_eq!(error.code(), "unsupported_provider");

        let unsupported = ResourceUri::unchecked("archive:///tmp/data.zip");
        let error = match registry.provider_for(&unsupported) {
            Ok(_) => panic!("expected unsupported provider error"),
            Err(error) => error,
        };

        assert_eq!(error.code(), "unsupported_provider");
    }

    #[test]
    fn registry_rejects_duplicate_scheme_registration() {
        let registry = VfsRegistry::new();

        registry.register(Arc::new(TestProvider)).unwrap();
        let error = registry.register(Arc::new(TestProvider)).unwrap_err();

        assert_eq!(error.code(), "duplicate_provider");
    }

    #[tokio::test]
    async fn registry_delegates_stat_and_list_to_registered_provider() {
        let registry = VfsRegistry::new();
        let uri = ResourceUri::parse("local:///Users").unwrap();
        let (sender, mut receiver) = tokio::sync::mpsc::channel(1);

        registry.register(Arc::new(TestProvider)).unwrap();

        let entry = registry.stat(&uri).await.unwrap();
        registry
            .list(
                &uri,
                ListOptions {
                    session_id: ListSessionId::new("session-1"),
                    request_id: "request-1".to_string(),
                    batch_size: 100,
                    include_hidden: false,
                    cancel: ListCancellation::new(),
                },
                sender,
            )
            .await
            .unwrap();

        assert_eq!(entry.name, "Users");
        assert!(receiver.recv().await.unwrap().is_complete);
    }
}
