use std::path::Path;

pub fn default_shell() -> String {
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            let path = Path::new(&shell);
            if path.is_absolute() && path.exists() {
                let lossy = shell.to_string();
                if !lossy.starts_with("/tmp/") && !lossy.starts_with("/var/tmp/") {
                    return shell;
                }
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
        "/bin/zsh".to_string()
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        "/bin/bash".to_string()
    }

    #[cfg(not(any(windows, unix)))]
    {
        "sh".to_string()
    }
}

pub fn shell_login_args(shell: &str) -> Vec<String> {
    let mut name = Path::new(shell)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(shell)
        .to_ascii_lowercase();
    if let Some(stripped) = name.strip_suffix(".exe") {
        name = stripped.to_string();
    }

    if name == "powershell" || name == "pwsh" {
        vec!["-NoLogo".to_string()]
    } else if name == "cmd" {
        vec![]
    } else if name.ends_with("sh") {
        vec!["-l".to_string()]
    } else {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::shell_login_args;

    #[test]
    fn shell_login_args_treats_windows_suffixed_unix_shells_as_login_shells() {
        assert_eq!(shell_login_args("bash.exe"), vec!["-l"]);
        assert_eq!(shell_login_args("zsh.exe"), vec!["-l"]);
    }

    #[test]
    fn shell_login_args_handles_windows_powershell_executables() {
        assert_eq!(shell_login_args("pwsh.exe"), vec!["-NoLogo"]);
        assert_eq!(shell_login_args("powershell.exe"), vec!["-NoLogo"]);
    }
}
