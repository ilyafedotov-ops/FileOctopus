use std::path::Path;

pub fn default_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        let path = Path::new(&shell);
        if path.is_absolute() && path.exists() {
            let lossy = shell.to_string();
            if !lossy.starts_with("/tmp/") && !lossy.starts_with("/var/tmp/") {
                return shell;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(comspec) = std::env::var("COMSPEC") {
            if !comspec.is_empty() {
                return comspec;
            }
        }
        return "cmd.exe".to_string();
    }

    #[cfg(target_os = "macos")]
    {
        return "/bin/zsh".to_string();
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return "/bin/bash".to_string();
    }

    #[cfg(not(any(windows, unix)))]
    {
        "sh".to_string()
    }
}

pub fn shell_login_args(shell: &str) -> Vec<String> {
    let name = Path::new(shell)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(shell);

    if name.ends_with("sh") {
        vec!["-l".to_string()]
    } else if name == "cmd.exe" || name == "cmd" {
        vec![]
    } else if name == "powershell.exe" || name == "powershell" || name == "pwsh" {
        vec!["-NoLogo".to_string()]
    } else {
        vec![]
    }
}
