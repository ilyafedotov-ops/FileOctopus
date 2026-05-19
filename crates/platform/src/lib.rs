mod secret_store;

pub use secret_store::{SecretStore, SecretStoreError};

pub fn crate_name() -> &'static str {
    "platform"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_crate_name() {
        assert_eq!(crate_name(), "platform");
    }
}
