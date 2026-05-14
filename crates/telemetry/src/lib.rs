use std::error::Error;
use std::sync::OnceLock;

use tracing_subscriber::EnvFilter;

static INIT: OnceLock<Result<(), String>> = OnceLock::new();

pub fn init() -> Result<(), Box<dyn Error + Send + Sync>> {
    INIT.get_or_init(|| {
        let filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("fileoctopus=debug,info"));
        let _ = tracing_subscriber::fmt().with_env_filter(filter).try_init();

        Ok(())
    })
    .clone()
    .map_err(Into::into)
}

pub fn info(message: &str) {
    tracing::info!("{}", message);
}

pub fn debug(message: &str) {
    tracing::debug!("{}", message);
}

pub fn error(message: &str) {
    tracing::error!("{}", message);
}
