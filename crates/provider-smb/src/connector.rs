use std::process::{Command, Stdio};
use std::sync::Arc;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfile};
use remote_core::{AuthSecrets, RemoteConnector, RemoteError, RemoteSession};

pub struct SmbSession {
    server: Arc<String>,
    credentials: Arc<SmbCredentials>,
}

#[derive(Clone)]
struct SmbCredentials {
    username: String,
    password: String,
}

impl SmbSession {
    pub fn new(server: String, username: String, password: String) -> Self {
        Self {
            server: Arc::new(server),
            credentials: Arc::new(SmbCredentials { username, password }),
        }
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            server: Arc::clone(&self.server),
            credentials: Arc::clone(&self.credentials),
        }
    }

    pub(crate) fn smbclient(&self) -> Command {
        let mut cmd = Command::new("smbclient");
        cmd.arg(format!("//{}", self.server))
            .arg("-U")
            .arg(self.credentials.username.as_str())
            .env("PASSWD", self.credentials.password.as_str())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        cmd
    }
}

#[async_trait]
impl RemoteSession for SmbSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        let output = self
            .smbclient()
            .arg("-c")
            .arg("ls")
            .output()
            .map_err(|e| RemoteError::Internal(format!("smbclient failed: {e}")))?;
        if !output.status.success() {
            return Err(RemoteError::ConnectionFailed {
                uri: format!("smb://{}", self.server),
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

pub struct SmbConnector;

impl Default for SmbConnector {
    fn default() -> Self {
        Self::new()
    }
}

impl SmbConnector {
    pub fn new() -> Self {
        Self
    }

    fn connect_blocking(
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
        uri: &str,
    ) -> Result<SmbSession, RemoteError> {
        let password =
            match profile.auth_kind {
                AuthKind::Password | AuthKind::AccessKey => secrets
                    .password
                    .as_deref()
                    .ok_or_else(|| RemoteError::AuthenticationFailed {
                        uri: uri.to_string(),
                        message: "missing password".to_string(),
                    })?,
                AuthKind::PrivateKey => {
                    return Err(RemoteError::AuthenticationFailed {
                        uri: uri.to_string(),
                        message: "SMB does not support private key authentication".to_string(),
                    })
                }
                AuthKind::OAuth => {
                    return Err(RemoteError::AuthenticationFailed {
                        uri: uri.to_string(),
                        message: "SMB does not support OAuth authentication".to_string(),
                    })
                }
            };

        let server = format!("{}:{}", profile.host, profile.port);
        Ok(SmbSession::new(
            server,
            profile.username.clone(),
            password.to_string(),
        ))
    }
}

#[async_trait]
impl RemoteConnector for SmbConnector {
    fn scheme(&self) -> &'static str {
        "smb"
    }

    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let profile = profile.clone();
        let secrets = secrets.clone();
        let uri = format!("smb://{}", profile.id);
        let session =
            tokio::task::spawn_blocking(move || Self::connect_blocking(&profile, &secrets, &uri))
                .await
                .map_err(|error| RemoteError::Internal(error.to_string()))??;
        Ok(Arc::new(session))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smbclient_command_does_not_expose_password_in_arguments() {
        let session = SmbSession::new(
            "server.local:445".to_string(),
            "user".to_string(),
            "secret123".to_string(),
        );
        let command = session.smbclient();
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(
            args.iter().all(|arg| !arg.contains("secret123")),
            "password must not be present in smbclient argv: {args:?}"
        );
    }
}
