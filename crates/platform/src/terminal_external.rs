use std::path::Path;
use std::process::Command;

#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct ExternalTerminalError(pub String);

pub fn path_contains_cmd_metacharacters(path: &Path) -> bool {
    path.to_string_lossy()
        .chars()
        .any(|c| matches!(c, '&' | '|' | '<' | '>' | '^' | '"' | '%' | '\n' | '\r'))
}

#[cfg(target_os = "windows")]
pub fn cmd_path_is_safe(path: &Path) -> bool {
    !path_contains_cmd_metacharacters(path)
}

#[cfg(not(target_os = "windows"))]
pub fn cmd_path_is_safe(_path: &Path) -> bool {
    true
}

pub fn open_external_terminal(path: &Path) -> Result<(), ExternalTerminalError> {
    if !path.is_dir() {
        return Err(ExternalTerminalError(format!(
            "directory not found: {}",
            path.display()
        )));
    }

    #[cfg(target_os = "macos")]
    {
        if Command::new("open")
            .args(["-a", "Terminal", path.to_string_lossy().as_ref()])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        if Command::new("open")
            .args(["-a", "iTerm", path.to_string_lossy().as_ref()])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        Err(ExternalTerminalError(
            "no terminal emulator found".to_string(),
        ))
    }

    #[cfg(target_os = "windows")]
    {
        if Command::new("wt.exe")
            .args(["-d", &path.to_string_lossy()])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        if !cmd_path_is_safe(path) {
            return Err(ExternalTerminalError(
                "directory name contains characters not safe for cmd.exe; install Windows Terminal"
                    .to_string(),
            ));
        }
        let cd_arg = format!("cd /d \"{}\"", path.display());
        if Command::new("cmd.exe")
            .args(["/K", &cd_arg])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        Err(ExternalTerminalError(
            "no terminal emulator found".to_string(),
        ))
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let terminals = [
            "gnome-terminal",
            "konsole",
            "xfce4-terminal",
            "alacritty",
            "kitty",
            "xterm",
        ];
        for term in terminals {
            if which::which(term).is_ok() {
                Command::new(term)
                    .current_dir(path)
                    .spawn()
                    .map_err(|e| ExternalTerminalError(e.to_string()))?;
                return Ok(());
            }
        }
        Err(ExternalTerminalError(
            "no terminal emulator found".to_string(),
        ))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = path;
        Err(ExternalTerminalError(
            "external terminal is not supported on this platform".to_string(),
        ))
    }
}
