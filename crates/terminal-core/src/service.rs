use std::fmt;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};

use dashmap::DashMap;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::TerminalError;
use crate::shell::{default_shell, shell_login_args};

const OUTPUT_CHUNK_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct TerminalId(pub Uuid);

impl TerminalId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn parse(value: &str) -> Result<Self, TerminalError> {
        Uuid::parse_str(value)
            .map(Self)
            .map_err(|_| TerminalError::not_found())
    }
}

impl fmt::Display for TerminalId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone)]
pub struct SpawnTerminalRequest {
    pub cwd: PathBuf,
    pub cols: u16,
    pub rows: u16,
    pub shell: Option<String>,
    pub args: Option<Vec<String>>,
    pub owner: String,
}

#[derive(Debug, Clone)]
pub enum TerminalEvent {
    Output {
        id: TerminalId,
        owner: String,
        data: Vec<u8>,
    },
    Exit {
        id: TerminalId,
        owner: String,
        exit_code: Option<i32>,
    },
}

struct SessionWriter {
    writer: Mutex<Box<dyn Write + Send>>,
    alive: AtomicBool,
}

struct SessionState {
    writer: Arc<SessionWriter>,
    master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
    owner: String,
}

pub struct TerminalService {
    sessions: DashMap<TerminalId, SessionState>,
    events_tx: Sender<TerminalEvent>,
    events_rx: Mutex<Option<Receiver<TerminalEvent>>>,
}

impl Default for TerminalService {
    fn default() -> Self {
        Self::new()
    }
}

impl TerminalService {
    pub fn new() -> Self {
        let (events_tx, events_rx) = mpsc::channel();
        Self {
            sessions: DashMap::new(),
            events_tx,
            events_rx: Mutex::new(Some(events_rx)),
        }
    }

    pub fn take_event_receiver(&self) -> Option<Receiver<TerminalEvent>> {
        self.events_rx
            .lock()
            .ok()
            .and_then(|mut guard| guard.take())
    }

    pub fn spawn(&self, request: SpawnTerminalRequest) -> Result<TerminalId, TerminalError> {
        if request.cols == 0 || request.rows == 0 {
            return Err(TerminalError::invalid_size());
        }
        if !request.cwd.is_dir() {
            return Err(TerminalError::spawn_failed(format!(
                "directory not found: {}",
                request.cwd.display()
            )));
        }

        let id = TerminalId::new();
        let owner = request.owner.clone();
        let shell = request.shell.unwrap_or_else(default_shell);
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: request.rows,
                cols: request.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| TerminalError::spawn_failed(e.to_string()))?;

        let mut command = CommandBuilder::new(&shell);
        command.cwd(&request.cwd);
        let args = request.args.unwrap_or_else(|| shell_login_args(&shell));
        for arg in args {
            command.arg(arg);
        }

        let PtyPair { master, slave } = pair;
        let child = slave
            .spawn_command(command)
            .map_err(|e| TerminalError::spawn_failed(e.to_string()))?;

        let child = Arc::new(Mutex::new(Some(child)));
        let child_for_thread = child.clone();

        let mut reader = master
            .try_clone_reader()
            .map_err(|e| TerminalError::spawn_failed(e.to_string()))?;
        let writer = master
            .take_writer()
            .map_err(|e| TerminalError::spawn_failed(e.to_string()))?;

        let session_writer = Arc::new(SessionWriter {
            writer: Mutex::new(writer),
            alive: AtomicBool::new(true),
        });

        self.sessions.insert(
            id,
            SessionState {
                writer: session_writer.clone(),
                master: Mutex::new(Some(master)),
                child,
                owner: owner.clone(),
            },
        );

        let events_tx = self.events_tx.clone();
        let session_id = id;
        let writer_for_read = session_writer;

        std::thread::spawn(move || {
            let mut buffer = [0u8; OUTPUT_CHUNK_BYTES];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => {
                        if events_tx
                            .send(TerminalEvent::Output {
                                id: session_id,
                                owner: owner.clone(),
                                data: buffer[..count].to_vec(),
                            })
                            .is_err()
                        {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }

            writer_for_read.alive.store(false, Ordering::SeqCst);
            let exit_code = child_for_thread
                .lock()
                .ok()
                .and_then(|mut guard| {
                    guard
                        .as_mut()
                        .map(|child| child.wait().ok().map(|status| status.exit_code() as i32))
                })
                .flatten();
            let _ = events_tx.send(TerminalEvent::Exit {
                id: session_id,
                owner,
                exit_code,
            });
        });

        Ok(id)
    }

    pub fn write(&self, id: TerminalId, owner: &str, data: &[u8]) -> Result<(), TerminalError> {
        let session = self
            .sessions
            .get(&id)
            .ok_or_else(TerminalError::not_found)?;
        if session.owner != owner {
            return Err(TerminalError::not_found());
        }
        if !session.writer.alive.load(Ordering::SeqCst) {
            return Err(TerminalError::session_exited());
        }
        let mut writer = session
            .writer
            .writer
            .lock()
            .map_err(|_| TerminalError::io("terminal writer lock poisoned"))?;
        writer
            .write_all(data)
            .map_err(|e| TerminalError::io(e.to_string()))?;
        writer
            .flush()
            .map_err(|e| TerminalError::io(e.to_string()))?;
        Ok(())
    }

    pub fn resize(
        &self,
        id: TerminalId,
        owner: &str,
        size: TerminalSize,
    ) -> Result<(), TerminalError> {
        if size.cols == 0 || size.rows == 0 {
            return Err(TerminalError::invalid_size());
        }
        let session = self
            .sessions
            .get(&id)
            .ok_or_else(TerminalError::not_found)?;
        if session.owner != owner {
            return Err(TerminalError::not_found());
        }
        let mut master_guard = session
            .master
            .lock()
            .map_err(|_| TerminalError::io("terminal master lock poisoned"))?;
        let master = master_guard
            .as_mut()
            .ok_or_else(TerminalError::session_exited)?;
        master
            .resize(PtySize {
                rows: size.rows,
                cols: size.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| TerminalError::io(e.to_string()))?;
        Ok(())
    }

    pub fn kill(&self, id: TerminalId, owner: &str) -> Result<(), TerminalError> {
        let (_, session) = self
            .sessions
            .remove(&id)
            .ok_or_else(TerminalError::not_found)?;
        if session.owner != owner {
            return Err(TerminalError::not_found());
        }
        if let Ok(mut guard) = session.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
            }
        }
        Ok(())
    }

    pub fn contains(&self, id: TerminalId) -> bool {
        self.sessions.contains_key(&id)
    }
}
