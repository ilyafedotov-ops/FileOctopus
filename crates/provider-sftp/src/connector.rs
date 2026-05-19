use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use config::{AuthKind, NetworkProfile};
use remote_core::{AuthSecrets, RemoteConnector, RemoteError, RemoteSession};
use ssh2::{FileStat, FileType, KeyboardInteractivePrompt, Prompt, Session};
use vfs::{EntryCapabilities, FileEntry, FileKind, ProviderId, ResourceUri, VfsError};

pub struct SftpSession {
    pub(crate) session: Arc<Mutex<Session>>,
    observed_fingerprint: Option<String>,
}

impl SftpSession {
    pub fn with_session(session: Session, observed_fingerprint: Option<String>) -> Self {
        Self {
            session: Arc::new(Mutex::new(session)),
            observed_fingerprint,
        }
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            session: Arc::clone(&self.session),
            observed_fingerprint: self.observed_fingerprint.clone(),
        }
    }

    pub fn lock_session(&self) -> Result<std::sync::MutexGuard<'_, Session>, RemoteError> {
        self.session
            .lock()
            .map_err(|_| RemoteError::Internal("sftp session lock poisoned".to_string()))
    }
}

#[async_trait]
impl RemoteSession for SftpSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        let session = self.lock_session()?;
        if !session.authenticated() {
            return Err(RemoteError::ConnectionFailed {
                uri: "sftp://".to_string(),
                message: "session is not authenticated".to_string(),
            });
        }
        Ok(())
    }

    fn observed_host_key_fingerprint(&self) -> Option<&str> {
        self.observed_fingerprint.as_deref()
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

pub struct SftpConnector;

impl Default for SftpConnector {
    fn default() -> Self {
        Self::new()
    }
}

impl SftpConnector {
    pub fn new() -> Self {
        Self
    }

    fn connect_blocking(
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
        uri: &str,
    ) -> Result<(Session, Option<String>), RemoteError> {
        let address = format!("{}:{}", profile.host, profile.port);
        let tcp = TcpStream::connect(&address).map_err(|error| RemoteError::ConnectionFailed {
            uri: uri.to_string(),
            message: error.to_string(),
        })?;
        let mut session = Session::new().map_err(|error| RemoteError::ConnectionFailed {
            uri: uri.to_string(),
            message: error.to_string(),
        })?;
        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|error| RemoteError::ConnectionFailed {
                uri: uri.to_string(),
                message: error.to_string(),
            })?;

        let fingerprint = session
            .host_key()
            .map(|(key, _)| sha256_base64_fingerprint(key));

        match (
            profile.host_key_fingerprint.as_deref(),
            fingerprint.as_deref(),
        ) {
            (Some(expected), Some(observed)) if expected != observed => {
                return Err(RemoteError::AuthenticationFailed {
                    uri: uri.to_string(),
                    message: format!(
                        "host key fingerprint mismatch (expected {expected}, got {observed})"
                    ),
                });
            }
            _ => {}
        }

        match profile.auth_kind {
            AuthKind::Password => {
                let password = secrets.password.as_deref().ok_or_else(|| {
                    RemoteError::AuthenticationFailed {
                        uri: uri.to_string(),
                        message: "missing password".to_string(),
                    }
                })?;

                // Most modern OpenSSH deployments accept passwords only via
                // keyboard-interactive (PAM). Plain `userauth_password` will
                // come back with Session(-18) even when the credentials are
                // correct. Try password first, then fall back to
                // keyboard-interactive using the same saved password.
                let password_err = session.userauth_password(&profile.username, password).err();

                if !session.authenticated() {
                    let mut prompter = PasswordPrompter(password);
                    let _ = session.userauth_keyboard_interactive(&profile.username, &mut prompter);
                }

                if !session.authenticated() {
                    return Err(authentication_failed_error(
                        &session,
                        &profile.username,
                        uri,
                        password_err,
                    ));
                }
            }
            AuthKind::PrivateKey => {
                let key_path = profile.private_key_path.as_deref().ok_or_else(|| {
                    RemoteError::AuthenticationFailed {
                        uri: uri.to_string(),
                        message: "missing private key path".to_string(),
                    }
                })?;
                let pubkey_err = session
                    .userauth_pubkey_file(
                        &profile.username,
                        None,
                        Path::new(key_path),
                        secrets.passphrase.as_deref(),
                    )
                    .err();

                if !session.authenticated() {
                    return Err(authentication_failed_error(
                        &session,
                        &profile.username,
                        uri,
                        pubkey_err,
                    ));
                }
            }
        }

        if !session.authenticated() {
            return Err(authentication_failed_error(
                &session,
                &profile.username,
                uri,
                None,
            ));
        }

        Ok((session, fingerprint))
    }
}

/// Prompter that answers every keyboard-interactive challenge with the saved
/// password. This is the standard way to proxy plain password auth through
/// servers that only advertise `keyboard-interactive`.
struct PasswordPrompter<'a>(&'a str);

impl KeyboardInteractivePrompt for PasswordPrompter<'_> {
    fn prompt<'a>(
        &mut self,
        _username: &str,
        _instructions: &str,
        prompts: &[Prompt<'a>],
    ) -> Vec<String> {
        prompts.iter().map(|_| self.0.to_string()).collect()
    }
}

fn authentication_failed_error(
    session: &Session,
    username: &str,
    uri: &str,
    cause: Option<ssh2::Error>,
) -> RemoteError {
    let detail = cause
        .map(|error| error.to_string())
        .unwrap_or_else(|| "authentication failed".to_string());
    let suffix = match session.auth_methods(username) {
        Ok(methods) if !methods.is_empty() => format!(" (server accepts: {methods})"),
        _ => String::new(),
    };
    RemoteError::AuthenticationFailed {
        uri: uri.to_string(),
        message: format!("{detail}{suffix}"),
    }
}

#[async_trait]
impl RemoteConnector for SftpConnector {
    fn scheme(&self) -> &'static str {
        "sftp"
    }

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let profile = profile.clone();
        let secrets = secrets.clone();
        let uri = format!("sftp://{}", profile.id);
        let (session, fingerprint) =
            tokio::task::spawn_blocking(move || Self::connect_blocking(&profile, &secrets, &uri))
                .await
                .map_err(|error| RemoteError::Internal(error.to_string()))??;
        Ok(Arc::new(SftpSession::with_session(session, fingerprint)))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        Ok(())
    }
}

pub fn sha256_base64_fingerprint(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};

    let digest = Sha256::digest(bytes);
    let encoded = data_encoding::BASE64_NOPAD.encode(&digest);
    format!("SHA256:{encoded}")
}

pub fn stat_path_blocking(
    session: &SftpSession,
    uri: &ResourceUri,
    remote_path: &str,
) -> Result<FileEntry, VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    let metadata = sftp
        .stat(Path::new(remote_path))
        .map_err(|error| map_stat_error(uri, error))?;
    Ok(build_entry(uri, remote_path, &metadata))
}

pub fn list_directory_blocking(
    session: &SftpSession,
    parent_uri: &ResourceUri,
    remote_path: &str,
    include_hidden: bool,
) -> Result<Vec<FileEntry>, VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    let mut directory = sftp
        .opendir(Path::new(remote_path))
        .map_err(|error| map_stat_error(parent_uri, error))?;
    let mut entries = Vec::new();

    loop {
        let (path, metadata) = match directory.readdir() {
            Ok(entry) => entry,
            Err(error) if is_readdir_eof(&error) => break,
            Err(error) => return Err(map_ssh_error(error)),
        };
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        if name.is_empty() || name == "." || name == ".." {
            continue;
        }
        if !include_hidden && name.starts_with('.') {
            continue;
        }

        let child_path = join_remote_path(remote_path, &name);
        let profile_id = parent_uri
            .remote_authority()
            .ok_or_else(|| VfsError::invalid_uri(parent_uri.as_str(), "missing profile id"))?;
        let child_uri = ResourceUri::from_remote_profile("sftp", profile_id, &child_path)?;
        entries.push(build_entry(&child_uri, &child_path, &metadata));
    }

    entries.sort_by_key(|entry| entry.name.to_lowercase());
    Ok(entries)
}

fn build_entry(uri: &ResourceUri, remote_path: &str, metadata: &FileStat) -> FileEntry {
    let name = remote_path
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or("/")
        .to_string();
    let kind = match metadata.file_type() {
        FileType::Directory => FileKind::Directory,
        FileType::Symlink => FileKind::Symlink,
        _ => FileKind::File,
    };
    let capabilities = match kind {
        FileKind::Directory => EntryCapabilities::read_only_directory(),
        _ => EntryCapabilities::read_only_file(),
    };
    let extension = if kind == FileKind::File {
        name.rsplit('.')
            .next()
            .filter(|part| *part != name)
            .map(str::to_string)
    } else {
        None
    };

    let is_hidden = name.starts_with('.');

    FileEntry {
        uri: uri.clone(),
        name,
        extension,
        kind,
        size: metadata.size,
        modified_at: metadata.mtime.and_then(unix_timestamp_to_utc),
        created_at: None,
        accessed_at: metadata.atime.and_then(unix_timestamp_to_utc),
        is_hidden,
        is_symlink: kind == FileKind::Symlink,
        symlink_target: None,
        provider_id: ProviderId::new("sftp"),
        capabilities,
        permissions: metadata.perm.map(|value| format!("{value:o}")),
        owner: metadata.uid.map(|value| value.to_string()),
    }
}

fn join_remote_path(base: &str, name: &str) -> String {
    if base.ends_with('/') {
        format!("{base}{name}")
    } else {
        format!("{base}/{name}")
    }
}

fn is_readdir_eof(error: &ssh2::Error) -> bool {
    matches!(
        error.code(),
        ssh2::ErrorCode::SFTP(1) | ssh2::ErrorCode::Session(-16)
    )
}

fn map_ssh_error(error: ssh2::Error) -> VfsError {
    VfsError::Internal {
        message: error.to_string(),
    }
}

fn map_stat_error(uri: &ResourceUri, error: ssh2::Error) -> VfsError {
    if error.code() == ssh2::ErrorCode::SFTP(2) {
        VfsError::not_found(uri)
    } else {
        VfsError::Internal {
            message: error.to_string(),
        }
    }
}

pub fn unix_timestamp_to_utc(value: u64) -> Option<DateTime<Utc>> {
    DateTime::<Utc>::from_timestamp(value as i64, 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::borrow::Cow;

    #[test]
    fn password_prompter_answers_every_prompt_with_saved_password() {
        let mut prompter = PasswordPrompter("hunter2");
        let prompts = [
            Prompt {
                text: Cow::Borrowed("Password: "),
                echo: false,
            },
            Prompt {
                text: Cow::Borrowed("Verification code: "),
                echo: true,
            },
        ];

        let answers = prompter.prompt("user", "", &prompts);

        assert_eq!(answers, vec!["hunter2".to_string(), "hunter2".to_string()]);
    }

    #[test]
    fn password_prompter_handles_empty_prompt_set() {
        let mut prompter = PasswordPrompter("anything");
        let answers = prompter.prompt("user", "", &[]);
        assert!(answers.is_empty());
    }
}
