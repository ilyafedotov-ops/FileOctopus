use std::path::{Path, PathBuf};
use std::process::Command;

use vfs::{FileOperationError, ResourceUri};

pub fn open_path_with_default_app(uri: &ResourceUri) -> Result<(), FileOperationError> {
    let path = existing_path(uri)?;

    launch_open_command(&path)
}

pub fn reveal_path_in_file_manager(uri: &ResourceUri) -> Result<(), FileOperationError> {
    let path = existing_path(uri)?;

    launch_reveal_command(&path)
}

fn existing_path(uri: &ResourceUri) -> Result<PathBuf, FileOperationError> {
    let path = uri.to_local_path()?;

    if !path.exists() {
        return Err(FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        });
    }

    Ok(path)
}

fn launch_open_command(path: &Path) -> Result<(), FileOperationError> {
    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(path).status()
    } else if cfg!(target_os = "windows") {
        Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg("Start-Process")
            .arg("-LiteralPath")
            .arg(path)
            .status()
    } else {
        Command::new("xdg-open").arg(path).status()
    };

    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(FileOperationError::io(
            "The operating system could not open this item.",
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Err(FileOperationError::io(
            "No default application is available for this item.",
        )),
        Err(error) => Err(FileOperationError::io(error.to_string())),
    }
}

fn launch_reveal_command(path: &Path) -> Result<(), FileOperationError> {
    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(path).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", path.to_string_lossy()))
            .status()
    } else {
        let target = if path.is_dir() {
            path
        } else {
            path.parent().unwrap_or(path)
        };
        Command::new("xdg-open").arg(target).status()
    };

    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(FileOperationError::io(
            "The operating system could not reveal this item.",
        )),
        Err(error) => Err(FileOperationError::io(error.to_string())),
    }
}
