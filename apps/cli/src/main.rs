use std::path::PathBuf;
use std::process::ExitCode;

use app_ipc::FileEntryDto;
use clap::{Parser, Subcommand};
use fs_core::LocalFsProvider;
use vfs::{
    DirectoryBatch, FileKind, ListCancellation, ListOptions, ListSessionId, ResourceUri, VfsError,
    VfsProvider,
};

#[derive(Parser)]
#[command(
    name = "fileoctopus-cli",
    version,
    about = "FileOctopus command-line tools"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    List {
        path: PathBuf,
        #[arg(long)]
        json: bool,
        #[arg(long)]
        hidden: bool,
    },
    Stat {
        path: PathBuf,
        #[arg(long)]
        json: bool,
    },
    Version,
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    match run(Cli::parse()).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            if error.is_user() {
                ExitCode::from(1)
            } else {
                ExitCode::from(2)
            }
        }
    }
}

enum CliError {
    User(String),
    Internal(String),
}

impl CliError {
    fn user(message: impl Into<String>) -> Self {
        Self::User(message.into())
    }

    fn internal(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }

    fn is_user(&self) -> bool {
        matches!(self, Self::User(_))
    }
}

impl std::fmt::Display for CliError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::User(message) | Self::Internal(message) => write!(f, "{message}"),
        }
    }
}

async fn run(cli: Cli) -> Result<(), CliError> {
    match cli.command {
        Commands::List { path, json, hidden } => list_path(path, json, hidden).await,
        Commands::Stat { path, json } => stat_path(path, json).await,
        Commands::Version => {
            println!("fileoctopus-cli {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
    }
}

fn uri_from_path(path: PathBuf) -> Result<ResourceUri, CliError> {
    let abs = std::fs::canonicalize(&path)
        .map_err(|error| CliError::user(format!("cannot resolve {}: {error}", path.display())))?;
    ResourceUri::from_local_path(&abs).map_err(|error| CliError::user(error.to_string()))
}

async fn stat_path(path: PathBuf, json: bool) -> Result<(), CliError> {
    let uri = uri_from_path(path)?;
    let provider = LocalFsProvider::new();
    let entry = provider.stat(&uri).await.map_err(map_vfs_error)?;
    let dto = FileEntryDto::from(entry);
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&dto)
                .map_err(|error| CliError::internal(error.to_string()))?
        );
    } else {
        print_entry_line(&dto);
    }
    Ok(())
}

async fn list_path(path: PathBuf, json: bool, hidden: bool) -> Result<(), CliError> {
    let uri = uri_from_path(path)?;
    let provider = LocalFsProvider::new();
    let (sink, mut rx) = tokio::sync::mpsc::channel::<DirectoryBatch>(32);
    let list_uri = uri.clone();
    let list_task = tokio::spawn(async move {
        provider
            .list(
                &list_uri,
                ListOptions {
                    session_id: ListSessionId::new("cli"),
                    request_id: "cli".to_string(),
                    batch_size: 512,
                    include_hidden: hidden,
                    cancel: ListCancellation::new(),
                },
                sink,
            )
            .await
    });

    let mut entries = Vec::new();
    while let Some(batch) = rx.recv().await {
        entries.extend(batch.entries);
    }

    list_task
        .await
        .map_err(|error| CliError::internal(error.to_string()))?
        .map_err(map_vfs_error)?;

    entries.sort_by_key(|entry| entry.name.to_lowercase());

    if json {
        let dtos: Vec<FileEntryDto> = entries.into_iter().map(FileEntryDto::from).collect();
        println!(
            "{}",
            serde_json::to_string_pretty(&dtos)
                .map_err(|error| CliError::internal(error.to_string()))?
        );
    } else {
        for entry in entries {
            print_entry_line(&FileEntryDto::from(entry));
        }
    }

    Ok(())
}

fn print_entry_line(entry: &FileEntryDto) {
    let kind = match entry.kind {
        FileKind::Directory => "dir",
        FileKind::File => "file",
        FileKind::Symlink => "symlink",
        FileKind::Archive => "archive",
        FileKind::Virtual => "virtual",
        FileKind::Unknown => "unknown",
    };
    let size = entry
        .size
        .map(|value| value.to_string())
        .unwrap_or_else(|| "-".to_string());
    println!("{kind:<10} {size:>12} {}", entry.name,);
}

fn map_vfs_error(error: VfsError) -> CliError {
    CliError::user(format!("{}: {}", error.code(), error))
}
