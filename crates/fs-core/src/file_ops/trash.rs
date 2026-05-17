use std::path::Path;
use std::process::Command;

use vfs::FileOperationError;

#[cfg(target_os = "linux")]
pub(super) fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    for command in ["gio", "kioclient5", "trash-put"] {
        let status = match command {
            "gio" => Command::new(command).arg("trash").arg(path).status(),
            "kioclient5" => Command::new(command)
                .arg("move")
                .arg(path)
                .arg("trash:/")
                .status(),
            _ => Command::new(command).arg(path).status(),
        };

        if matches!(status, Ok(status) if status.success()) {
            return Ok(());
        }
    }

    Err(FileOperationError::UnsupportedTrash {
        message: "OS trash command is unavailable".to_string(),
    })
}

#[cfg(target_os = "macos")]
pub(super) fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    let script = format!(
        "tell application \"Finder\" to delete POSIX file \"{}\"",
        path.to_string_lossy().replace('"', "\\\"")
    );
    let status = Command::new("osascript").arg("-e").arg(script).status();

    if matches!(status, Ok(status) if status.success()) {
        return Ok(());
    }

    Err(FileOperationError::UnsupportedTrash {
        message: "macOS Trash command failed".to_string(),
    })
}

#[cfg(target_os = "windows")]
pub(super) fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    let escaped = path.to_string_lossy().replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{}', 'OnlyErrorDialogs', 'SendToRecycleBin')",
        escaped
    );
    let status = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(script)
        .status();

    if matches!(status, Ok(status) if status.success()) {
        return Ok(());
    }

    Err(FileOperationError::UnsupportedTrash {
        message: "Windows Recycle Bin command failed".to_string(),
    })
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
pub(super) fn move_to_trash(_path: &Path) -> Result<(), FileOperationError> {
    Err(FileOperationError::UnsupportedTrash {
        message: "Move to Trash is unsupported on this platform".to_string(),
    })
}
