use std::error::Error;
use std::fmt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tokio::sync::broadcast;
use tracing::field::{Field, Visit};
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::{Context, Layer, SubscriberExt};
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

static INIT: OnceLock<Result<tracing_appender::non_blocking::WorkerGuard, String>> =
    OnceLock::new();

/// Bounded channel of structured log records used to stream backend logs to the
/// UI on demand. Records are only produced while [`set_streaming`] is enabled,
/// keeping the layer effectively free during normal operation.
static LOG_SENDER: OnceLock<broadcast::Sender<LogRecord>> = OnceLock::new();
static STREAMING: AtomicBool = AtomicBool::new(false);
const LOG_CHANNEL_CAPACITY: usize = 1024;

/// A single structured log record forwarded to subscribers of the live log
/// stream. Mirrors the fields surfaced to the diagnostics console.
#[derive(Clone, Debug, Serialize)]
pub struct LogRecord {
    pub level: String,
    pub target: String,
    pub message: String,
    pub timestamp_ms: u64,
}

fn log_sender() -> &'static broadcast::Sender<LogRecord> {
    LOG_SENDER.get_or_init(|| broadcast::channel(LOG_CHANNEL_CAPACITY).0)
}

/// Subscribe to the live backend log stream. Records are only sent while
/// streaming is enabled via [`set_streaming`].
pub fn subscribe() -> broadcast::Receiver<LogRecord> {
    log_sender().subscribe()
}

/// Enable or disable live log streaming. While disabled the broadcast layer
/// returns immediately without formatting or sending records.
pub fn set_streaming(enabled: bool) {
    STREAMING.store(enabled, Ordering::Relaxed);
}

pub fn streaming_enabled() -> bool {
    STREAMING.load(Ordering::Relaxed)
}

pub fn init() -> Result<(), Box<dyn Error + Send + Sync>> {
    INIT.get_or_init(|| {
        let filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new(default_filter_directives()));
        let log_dir = default_log_dir();

        std::fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;

        let file_appender = tracing_appender::rolling::daily(log_dir, "fileoctopus.log");
        let (writer, guard) = tracing_appender::non_blocking(file_appender);

        let fmt_layer = tracing_subscriber::fmt::layer()
            .with_writer(writer)
            .with_ansi(false);

        tracing_subscriber::registry()
            .with(filter)
            .with(fmt_layer)
            .with(BroadcastLayer)
            .try_init()
            .map_err(|error| error.to_string())?;

        Ok(guard)
    })
    .as_ref()
    .map(|_| ())
    .map_err(|error| error.clone().into())
}

/// `tracing` layer that forwards each event onto the broadcast channel while
/// streaming is enabled and at least one receiver is connected.
struct BroadcastLayer;

impl<S: Subscriber> Layer<S> for BroadcastLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        if !streaming_enabled() {
            return;
        }
        let sender = log_sender();
        if sender.receiver_count() == 0 {
            return;
        }

        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);

        let metadata = event.metadata();
        let record = LogRecord {
            level: metadata.level().to_string(),
            target: metadata.target().to_string(),
            message: visitor.into_message(),
            timestamp_ms: now_ms(),
        };

        let _ = sender.send(record);
    }
}

#[derive(Default)]
struct MessageVisitor {
    message: String,
    fields: String,
}

impl MessageVisitor {
    fn into_message(self) -> String {
        match (self.message.is_empty(), self.fields.is_empty()) {
            (true, true) => String::new(),
            (true, false) => self.fields,
            (false, true) => self.message,
            (false, false) => format!("{} {}", self.message, self.fields),
        }
    }
}

impl Visit for MessageVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{value:?}");
        } else {
            if !self.fields.is_empty() {
                self.fields.push(' ');
            }
            self.fields.push_str(&format!("{}={value:?}", field.name()));
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn default_filter_directives() -> &'static str {
    "app_core=debug,fileoctopus_desktop_lib=debug,fs_core=debug,remote_core=debug,terminal_core=debug,info"
}

pub fn default_log_dir() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".fileoctopus")
        .join("logs")
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

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tracing::subscriber::with_default;
    use tracing_subscriber::layer::SubscriberExt;

    #[tokio::test]
    async fn forwards_events_only_while_streaming() {
        // Use a local subscriber so the test does not depend on global init().
        let subscriber = tracing_subscriber::registry().with(BroadcastLayer);

        let mut rx = subscribe();
        set_streaming(false);

        with_default(subscriber, || {
            tracing::info!("while disabled");
        });
        assert!(
            rx.try_recv().is_err(),
            "no record should be sent while streaming is disabled"
        );

        set_streaming(true);
        let subscriber = tracing_subscriber::registry().with(BroadcastLayer);
        with_default(subscriber, || {
            tracing::warn!(target: "telemetry::test", "hello {}", "world");
        });
        set_streaming(false);

        let record = rx.try_recv().expect("a record should be received");
        assert_eq!(record.level, "WARN");
        assert_eq!(record.target, "telemetry::test");
        assert_eq!(record.message, "hello world");
    }
}
