use std::fmt;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use dashmap::DashMap;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use ssh2::{Channel, KeyboardInteractivePrompt, Prompt, Session};
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
    pub cwd_uri: Option<String>,
    pub cols: u16,
    pub rows: u16,
    pub shell: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Vec<(String, String)>,
    pub terminal_profile_id: Option<String>,
    pub title: Option<String>,
    pub owner: String,
}

#[derive(Debug, Clone)]
pub enum RemoteTerminalAuth {
    Password {
        password: String,
    },
    PrivateKey {
        private_key_path: String,
        passphrase: Option<String>,
    },
}

#[derive(Debug, Clone)]
pub struct SpawnRemoteTerminalRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: RemoteTerminalAuth,
    pub expected_host_key_fingerprint: Option<String>,
    pub cols: u16,
    pub rows: u16,
    pub cwd_uri: Option<String>,
    pub terminal_profile_id: Option<String>,
    pub title: Option<String>,
    pub owner: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpawnRemoteTerminalResponse {
    pub id: TerminalId,
    pub observed_host_key_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TerminalSessionStatus {
    Starting,
    Running,
    Exited,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TerminalSessionSnapshot {
    pub id: TerminalId,
    pub owner: String,
    pub status: TerminalSessionStatus,
    pub title: String,
    pub cwd_uri: Option<String>,
    pub terminal_profile_id: Option<String>,
    pub transport: String,
    pub cols: u16,
    pub rows: u16,
    pub exit_code: Option<i32>,
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
    Session {
        kind: &'static str,
        snapshot: TerminalSessionSnapshot,
    },
}

struct SessionWriter {
    writer: Mutex<Box<dyn Write + Send>>,
    alive: AtomicBool,
}

struct SessionState {
    backend: SessionBackend,
    owner: String,
    metadata: Arc<Mutex<TerminalSessionSnapshot>>,
}

enum SessionBackend {
    Local {
        writer: Arc<SessionWriter>,
        master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
        child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
    },
    Ssh {
        commands: Sender<SshTerminalCommand>,
        alive: Arc<AtomicBool>,
    },
}

enum SshTerminalCommand {
    Write(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Kill,
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
        let title = request.title.unwrap_or_else(|| {
            Path::new(&shell)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Terminal")
                .to_string()
        });
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
        for (key, value) in request.env {
            command.env(key, value);
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
        let metadata = Arc::new(Mutex::new(TerminalSessionSnapshot {
            id,
            owner: owner.clone(),
            status: TerminalSessionStatus::Running,
            title,
            cwd_uri: request.cwd_uri,
            terminal_profile_id: request.terminal_profile_id,
            transport: "local".to_string(),
            cols: request.cols,
            rows: request.rows,
            exit_code: None,
        }));

        self.sessions.insert(
            id,
            SessionState {
                backend: SessionBackend::Local {
                    writer: session_writer.clone(),
                    master: Mutex::new(Some(master)),
                    child,
                },
                owner: owner.clone(),
                metadata: metadata.clone(),
            },
        );
        let _ = self.events_tx.send(TerminalEvent::Session {
            kind: "started",
            snapshot: metadata
                .lock()
                .map(|guard| guard.clone())
                .unwrap_or_else(|_| TerminalSessionSnapshot {
                    id,
                    owner: owner.clone(),
                    status: TerminalSessionStatus::Running,
                    title: "Terminal".to_string(),
                    cwd_uri: None,
                    terminal_profile_id: None,
                    transport: "local".to_string(),
                    cols: request.cols,
                    rows: request.rows,
                    exit_code: None,
                }),
        });

        let events_tx = self.events_tx.clone();
        let session_id = id;
        let writer_for_read = session_writer;
        let metadata_for_thread = metadata;

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
            let snapshot = metadata_for_thread.lock().ok().map(|mut guard| {
                guard.status = TerminalSessionStatus::Exited;
                guard.exit_code = exit_code;
                guard.clone()
            });
            let _ = events_tx.send(TerminalEvent::Exit {
                id: session_id,
                owner,
                exit_code,
            });
            if let Some(snapshot) = snapshot {
                let _ = events_tx.send(TerminalEvent::Session {
                    kind: "exited",
                    snapshot,
                });
            }
        });

        Ok(id)
    }

    pub fn spawn_ssh(
        &self,
        request: SpawnRemoteTerminalRequest,
    ) -> Result<SpawnRemoteTerminalResponse, TerminalError> {
        if request.cols == 0 || request.rows == 0 {
            return Err(TerminalError::invalid_size());
        }

        let id = TerminalId::new();
        let owner = request.owner.clone();
        let (session, observed_host_key_fingerprint) = connect_ssh_session(&request)?;
        session.set_blocking(false);
        let mut channel = session
            .channel_session()
            .map_err(|error| TerminalError::spawn_failed(error.to_string()))?;
        channel
            .request_pty(
                "xterm-256color",
                None,
                Some((request.cols as u32, request.rows as u32, 0, 0)),
            )
            .map_err(|error| TerminalError::spawn_failed(error.to_string()))?;
        channel
            .shell()
            .map_err(|error| TerminalError::spawn_failed(error.to_string()))?;

        let (commands, rx) = mpsc::channel();
        let alive = Arc::new(AtomicBool::new(true));
        let metadata = Arc::new(Mutex::new(TerminalSessionSnapshot {
            id,
            owner: owner.clone(),
            status: TerminalSessionStatus::Running,
            title: request.title.unwrap_or_else(|| request.host.clone()),
            cwd_uri: request.cwd_uri,
            terminal_profile_id: request.terminal_profile_id,
            transport: "ssh".to_string(),
            cols: request.cols,
            rows: request.rows,
            exit_code: None,
        }));
        let alive_for_thread = alive.clone();
        let events_tx = self.events_tx.clone();
        let session_id = id;
        let thread_owner = owner.clone();
        let metadata_for_thread = metadata.clone();

        std::thread::spawn(move || {
            let exit_code =
                run_ssh_terminal_loop(&mut channel, rx, &events_tx, session_id, &thread_owner);
            alive_for_thread.store(false, Ordering::SeqCst);
            let snapshot = metadata_for_thread.lock().ok().map(|mut guard| {
                guard.status = TerminalSessionStatus::Exited;
                guard.exit_code = exit_code;
                guard.clone()
            });
            let _ = events_tx.send(TerminalEvent::Exit {
                id: session_id,
                owner: thread_owner,
                exit_code,
            });
            if let Some(snapshot) = snapshot {
                let _ = events_tx.send(TerminalEvent::Session {
                    kind: "exited",
                    snapshot,
                });
            }
            drop(session);
        });

        self.sessions.insert(
            id,
            SessionState {
                backend: SessionBackend::Ssh { commands, alive },
                owner,
                metadata: metadata.clone(),
            },
        );
        let _ = self.events_tx.send(TerminalEvent::Session {
            kind: "started",
            snapshot: metadata
                .lock()
                .map(|guard| guard.clone())
                .unwrap_or_else(|_| TerminalSessionSnapshot {
                    id,
                    owner: request.owner,
                    status: TerminalSessionStatus::Running,
                    title: "SSH".to_string(),
                    cwd_uri: None,
                    terminal_profile_id: None,
                    transport: "ssh".to_string(),
                    cols: request.cols,
                    rows: request.rows,
                    exit_code: None,
                }),
        });

        Ok(SpawnRemoteTerminalResponse {
            id,
            observed_host_key_fingerprint,
        })
    }

    pub fn send_text(&self, id: TerminalId, owner: &str, text: &str) -> Result<(), TerminalError> {
        self.write(id, owner, text.as_bytes())
    }

    pub fn run_command(
        &self,
        id: TerminalId,
        owner: &str,
        command: &str,
        append_newline: bool,
    ) -> Result<(), TerminalError> {
        let mut text = command.to_string();
        if append_newline && !text.ends_with('\n') {
            text.push('\n');
        }
        self.send_text(id, owner, &text)
    }

    pub fn write(&self, id: TerminalId, owner: &str, data: &[u8]) -> Result<(), TerminalError> {
        let session = self
            .sessions
            .get(&id)
            .ok_or_else(TerminalError::not_found)?;
        if session.owner != owner {
            return Err(TerminalError::not_found());
        }
        match &session.backend {
            SessionBackend::Local { writer, .. } => {
                if !writer.alive.load(Ordering::SeqCst) {
                    return Err(TerminalError::session_exited());
                }
                let mut writer = writer
                    .writer
                    .lock()
                    .map_err(|_| TerminalError::io("terminal writer lock poisoned"))?;
                writer
                    .write_all(data)
                    .map_err(|e| TerminalError::io(e.to_string()))?;
                writer
                    .flush()
                    .map_err(|e| TerminalError::io(e.to_string()))?;
            }
            SessionBackend::Ssh { commands, alive } => {
                if !alive.load(Ordering::SeqCst) {
                    return Err(TerminalError::session_exited());
                }
                commands
                    .send(SshTerminalCommand::Write(data.to_vec()))
                    .map_err(|_| TerminalError::session_exited())?;
            }
        }
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
        match &session.backend {
            SessionBackend::Local { master, .. } => {
                let mut master_guard = master
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
            }
            SessionBackend::Ssh { commands, alive } => {
                if !alive.load(Ordering::SeqCst) {
                    return Err(TerminalError::session_exited());
                }
                commands
                    .send(SshTerminalCommand::Resize {
                        cols: size.cols,
                        rows: size.rows,
                    })
                    .map_err(|_| TerminalError::session_exited())?;
            }
        }
        if let Ok(mut metadata) = session.metadata.lock() {
            metadata.cols = size.cols;
            metadata.rows = size.rows;
            let _ = self.events_tx.send(TerminalEvent::Session {
                kind: "updated",
                snapshot: metadata.clone(),
            });
        }
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
        let metadata = session.metadata.clone();
        match session.backend {
            SessionBackend::Local { child, .. } => {
                if let Ok(mut guard) = child.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
            SessionBackend::Ssh { commands, .. } => {
                let _ = commands.send(SshTerminalCommand::Kill);
            }
        }
        if let Ok(mut metadata) = metadata.lock() {
            metadata.status = TerminalSessionStatus::Exited;
            let _ = self.events_tx.send(TerminalEvent::Session {
                kind: "killed",
                snapshot: metadata.clone(),
            });
        }
        Ok(())
    }

    pub fn contains(&self, id: TerminalId) -> bool {
        self.sessions.contains_key(&id)
    }

    pub fn list_sessions(&self, owner: &str) -> Vec<TerminalSessionSnapshot> {
        self.sessions
            .iter()
            .filter(|item| item.owner == owner)
            .filter_map(|item| item.metadata.lock().ok().map(|guard| guard.clone()))
            .collect()
    }
}

fn connect_ssh_session(
    request: &SpawnRemoteTerminalRequest,
) -> Result<(Session, Option<String>), TerminalError> {
    let address = format!("{}:{}", request.host, request.port);
    let tcp = TcpStream::connect(&address)
        .map_err(|error| TerminalError::spawn_failed(error.to_string()))?;
    let mut session =
        Session::new().map_err(|error| TerminalError::spawn_failed(error.to_string()))?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|error| TerminalError::spawn_failed(error.to_string()))?;

    let fingerprint = session
        .host_key()
        .map(|(key, _)| sha256_base64_fingerprint(key));
    if let (Some(expected), Some(observed)) = (
        request.expected_host_key_fingerprint.as_deref(),
        fingerprint.as_deref(),
    ) {
        if expected != observed {
            return Err(TerminalError::spawn_failed(format!(
                "host key fingerprint mismatch (expected {expected}, got {observed})"
            )));
        }
    }

    match &request.auth {
        RemoteTerminalAuth::Password { password } => {
            let password_error = session.userauth_password(&request.username, password).err();
            if !session.authenticated() {
                let mut prompter = PasswordPrompter(password);
                let _ = session.userauth_keyboard_interactive(&request.username, &mut prompter);
            }
            if !session.authenticated() {
                return Err(authentication_failed_error(
                    &session,
                    &request.username,
                    password_error,
                ));
            }
        }
        RemoteTerminalAuth::PrivateKey {
            private_key_path,
            passphrase,
        } => {
            let key_error = session
                .userauth_pubkey_file(
                    &request.username,
                    None,
                    Path::new(private_key_path),
                    passphrase.as_deref(),
                )
                .err();
            if !session.authenticated() {
                return Err(authentication_failed_error(
                    &session,
                    &request.username,
                    key_error,
                ));
            }
        }
    }

    Ok((session, fingerprint))
}

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
    cause: Option<ssh2::Error>,
) -> TerminalError {
    let detail = cause
        .map(|error| error.to_string())
        .unwrap_or_else(|| "authentication failed".to_string());
    let suffix = match session.auth_methods(username) {
        Ok(methods) if !methods.is_empty() => format!(" (server accepts: {methods})"),
        _ => String::new(),
    };
    TerminalError::authentication_failed(format!("{detail}{suffix}"))
}

fn run_ssh_terminal_loop(
    channel: &mut Channel,
    rx: Receiver<SshTerminalCommand>,
    events_tx: &Sender<TerminalEvent>,
    id: TerminalId,
    owner: &str,
) -> Option<i32> {
    let mut buffer = [0u8; OUTPUT_CHUNK_BYTES];
    loop {
        while let Ok(command) = rx.try_recv() {
            match command {
                SshTerminalCommand::Write(data) => {
                    let _ = channel.write_all(&data);
                    let _ = channel.flush();
                }
                SshTerminalCommand::Resize { cols, rows } => {
                    let _ = channel.request_pty_size(cols as u32, rows as u32, None, None);
                }
                SshTerminalCommand::Kill => {
                    let _ = channel.close();
                    return channel.exit_status().ok();
                }
            }
        }

        match channel.read(&mut buffer) {
            Ok(0) => {
                if channel.eof() {
                    return channel.exit_status().ok();
                }
            }
            Ok(count) => {
                if events_tx
                    .send(TerminalEvent::Output {
                        id,
                        owner: owner.to_string(),
                        data: buffer[..count].to_vec(),
                    })
                    .is_err()
                {
                    return None;
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(_) => return channel.exit_status().ok(),
        }

        std::thread::sleep(Duration::from_millis(10));
    }
}

fn sha256_base64_fingerprint(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};

    let digest = Sha256::digest(bytes);
    let encoded = data_encoding::BASE64_NOPAD.encode(&digest);
    format!("SHA256:{encoded}")
}
