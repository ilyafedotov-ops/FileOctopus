use thiserror::Error;

const SERVICE_NAME: &str = "fileoctopus";

#[derive(Debug, Error)]
pub enum SecretStoreError {
    #[error("keychain unavailable: {0}")]
    Unavailable(String),
    #[error("secret not found")]
    NotFound,
    #[error("keychain error: {0}")]
    Keyring(String),
}

#[derive(Clone, Default)]
pub struct SecretStore;

impl SecretStore {
    pub fn new() -> Self {
        Self
    }

    pub fn set(&self, key: &str, value: &str) -> Result<(), SecretStoreError> {
        let entry = keyring::Entry::new(SERVICE_NAME, key)
            .map_err(|error| SecretStoreError::Unavailable(error.to_string()))?;
        entry
            .set_password(value)
            .map_err(|error| SecretStoreError::Keyring(error.to_string()))
    }

    pub fn get(&self, key: &str) -> Result<String, SecretStoreError> {
        let entry = keyring::Entry::new(SERVICE_NAME, key)
            .map_err(|error| SecretStoreError::Unavailable(error.to_string()))?;
        entry.get_password().map_err(|error| match error {
            keyring::Error::NoEntry => SecretStoreError::NotFound,
            other => SecretStoreError::Keyring(other.to_string()),
        })
    }

    pub fn delete(&self, key: &str) -> Result<(), SecretStoreError> {
        let entry = keyring::Entry::new(SERVICE_NAME, key)
            .map_err(|error| SecretStoreError::Unavailable(error.to_string()))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(SecretStoreError::Keyring(error.to_string())),
        }
    }

    pub fn has(&self, key: &str) -> bool {
        self.get(key).is_ok()
    }

    pub fn network_password_key(profile_id: &str) -> String {
        format!("network/{profile_id}/password")
    }

    pub fn network_passphrase_key(profile_id: &str) -> String {
        format!("network/{profile_id}/passphrase")
    }
}
