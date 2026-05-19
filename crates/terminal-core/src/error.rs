use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerminalErrorCode {
    SpawnFailed,
    NotFound,
    InvalidSize,
    Io,
    SessionExited,
}

impl TerminalErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SpawnFailed => "terminal_spawn_failed",
            Self::NotFound => "terminal_not_found",
            Self::InvalidSize => "invalid_terminal_size",
            Self::Io => "io_error",
            Self::SessionExited => "terminal_session_exited",
        }
    }
}

#[derive(Debug, Error)]
#[error("{code}: {message}", code = code.as_str())]
pub struct TerminalError {
    pub code: TerminalErrorCode,
    pub message: String,
}

impl TerminalError {
    pub fn spawn_failed(message: impl Into<String>) -> Self {
        Self {
            code: TerminalErrorCode::SpawnFailed,
            message: message.into(),
        }
    }

    pub fn not_found() -> Self {
        Self {
            code: TerminalErrorCode::NotFound,
            message: "terminal session not found".to_string(),
        }
    }

    pub fn invalid_size() -> Self {
        Self {
            code: TerminalErrorCode::InvalidSize,
            message: "terminal cols and rows must be greater than zero".to_string(),
        }
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self {
            code: TerminalErrorCode::Io,
            message: message.into(),
        }
    }

    pub fn session_exited() -> Self {
        Self {
            code: TerminalErrorCode::SessionExited,
            message: "terminal session has exited".to_string(),
        }
    }
}
