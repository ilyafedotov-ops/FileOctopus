use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VfsError {
    InvalidUri { uri: String, reason: String },
    UnsupportedProvider { scheme: String },
}

impl VfsError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidUri { .. } => "invalid_uri",
            Self::UnsupportedProvider { .. } => "unsupported_provider",
        }
    }

    fn invalid_uri(uri: &str, reason: &str) -> Self {
        Self::InvalidUri {
            uri: uri.to_string(),
            reason: reason.to_string(),
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
}
