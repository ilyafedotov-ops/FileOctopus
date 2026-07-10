use thiserror::Error;
use vfs::VfsError;

#[derive(Debug, Error)]
pub enum RemoteError {
    #[error("network profile not found")]
    ProfileNotFound,
    #[error("unsupported scheme `{scheme}`")]
    UnsupportedScheme { scheme: String },
    #[error("authentication failed for `{uri}`: {message}")]
    AuthenticationFailed { uri: String, message: String },
    #[error("SSH host key for `{uri}` is not trusted: {fingerprint}")]
    HostKeyUntrusted { uri: String, fingerprint: String },
    #[error("SSH host key mismatch for `{uri}` (expected {expected}, observed {observed})")]
    HostKeyMismatch {
        uri: String,
        expected: String,
        observed: String,
    },
    #[error("SSH host key confirmation is missing or stale for `{uri}`")]
    HostKeyConfirmationRequired { uri: String },
    #[error("connection failed for `{uri}`: {message}")]
    ConnectionFailed { uri: String, message: String },
    #[error("connection not established for `{uri}`")]
    NotConnected { uri: String },
    #[error("secret store error: {0}")]
    SecretStore(#[from] platform::SecretStoreError),
    #[error("network repository error: {0}")]
    Network(#[from] config::NetworkError),
    #[error("internal error: {0}")]
    Internal(String),
}

impl RemoteError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::ProfileNotFound => "not_found",
            Self::UnsupportedScheme { .. } => "unsupported_provider",
            Self::AuthenticationFailed { .. } => "authentication_failed",
            Self::HostKeyUntrusted { .. } | Self::HostKeyConfirmationRequired { .. } => {
                "host_key_untrusted"
            }
            Self::HostKeyMismatch { .. } => "host_key_mismatch",
            Self::ConnectionFailed { .. } => "connection_lost",
            Self::NotConnected { .. } => "connection_required",
            Self::SecretStore(error) => match error {
                platform::SecretStoreError::NotFound => "authentication_failed",
                _ => "internal",
            },
            Self::Network(error) => match error {
                config::NetworkError::ProfileNotFound => "not_found",
                config::NetworkError::InvalidValue { .. } => "invalid_request",
                _ => "internal",
            },
            Self::Internal(_) => "internal",
        }
    }
}

impl From<RemoteError> for VfsError {
    fn from(error: RemoteError) -> Self {
        match error {
            RemoteError::ProfileNotFound => Self::NotFound {
                uri: "network profile".to_string(),
            },
            RemoteError::UnsupportedScheme { scheme } => Self::UnsupportedProvider { scheme },
            RemoteError::AuthenticationFailed { uri, message } => {
                Self::AuthenticationFailed { uri, message }
            }
            RemoteError::HostKeyUntrusted { uri, fingerprint } => Self::AuthenticationFailed {
                uri,
                message: format!("SSH host key is not trusted: {fingerprint}"),
            },
            RemoteError::HostKeyMismatch {
                uri,
                expected,
                observed,
            } => Self::AuthenticationFailed {
                uri,
                message: format!(
                    "SSH host key mismatch (expected {expected}, observed {observed})"
                ),
            },
            RemoteError::HostKeyConfirmationRequired { uri } => Self::AuthenticationFailed {
                uri,
                message: "SSH host key confirmation is missing or stale".to_string(),
            },
            RemoteError::ConnectionFailed { uri, message } => Self::ConnectionLost { uri, message },
            RemoteError::NotConnected { uri } => Self::ConnectionRequired { uri },
            RemoteError::SecretStore(platform::SecretStoreError::NotFound) => {
                Self::AuthenticationFailed {
                    uri: "sftp://".to_string(),
                    message: "missing stored credentials".to_string(),
                }
            }
            RemoteError::SecretStore(error) => Self::Internal {
                message: error.to_string(),
            },
            RemoteError::Network(error) => Self::Internal {
                message: error.to_string(),
            },
            RemoteError::Internal(message) => Self::Internal { message },
        }
    }
}
