use config::{AuthKind, NetworkProfile};
use platform::SecretStore;

pub const MISSING_STORED_PASSWORD: &str =
    "No password saved for this server. Edit the server and enter your password.";

#[derive(Debug, Clone)]
pub struct AuthSecrets {
    pub password: Option<String>,
    pub passphrase: Option<String>,
}

impl AuthSecrets {
    pub fn profile_has_stored_secret(profile: &NetworkProfile) -> bool {
        match profile.auth_kind {
            AuthKind::Password => profile.has_stored_secret,
            AuthKind::PrivateKey => profile
                .private_key_path
                .as_ref()
                .is_some_and(|path| !path.is_empty()),
        }
    }

    pub fn load(
        store: &SecretStore,
        profile: &NetworkProfile,
    ) -> Result<Self, platform::SecretStoreError> {
        match profile.auth_kind {
            AuthKind::Password => Ok(Self {
                password: Some(store.get(&SecretStore::network_password_key(&profile.id))?),
                passphrase: None,
            }),
            AuthKind::PrivateKey => {
                let passphrase = store
                    .get(&SecretStore::network_passphrase_key(&profile.id))
                    .ok();
                Ok(Self {
                    password: None,
                    passphrase,
                })
            }
        }
    }
}
