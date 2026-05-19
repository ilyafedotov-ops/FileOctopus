mod secret_store;
mod terminal_external;

pub use secret_store::{SecretStore, SecretStoreError};
pub use terminal_external::{
    cmd_path_is_safe, open_external_terminal, path_contains_cmd_metacharacters,
    ExternalTerminalError,
};

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
