use vfs::{
    EntryCapabilities, FileEntry, FileKind, ListCancellation, ProviderId, ResourceUri, VfsError,
};

use crate::connector::SmbSession;

pub fn stat_path_blocking(
    session: &SmbSession,
    uri: &ResourceUri,
    smb_path: &str,
) -> Result<FileEntry, VfsError> {
    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!("allinfo \"{}\"", smb_path.trim_start_matches('/')))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(map_smb_error(uri, &stderr));
    }

    let name = smb_path
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|v| !v.is_empty())
        .unwrap_or("/")
        .to_string();

    let stdout = String::from_utf8_lossy(&output.stdout);
    let is_dir = stdout.contains("attributes: D") || stdout.contains("type: directory");

    let kind = if is_dir {
        FileKind::Directory
    } else {
        FileKind::File
    };

    let extension = if kind == FileKind::File {
        name.rsplit('.')
            .next()
            .filter(|part| *part != name)
            .map(str::to_string)
    } else {
        None
    };

    let capabilities = if is_dir {
        EntryCapabilities::writable_directory()
    } else {
        EntryCapabilities::writable_file()
    };

    Ok(FileEntry {
        uri: uri.clone(),
        name,
        extension,
        kind,
        size: None,
        modified_at: None,
        created_at: None,
        accessed_at: None,
        is_hidden: false,
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: ProviderId::new("smb"),
        capabilities,
        permissions: None,
        owner: None,
    })
}

pub fn list_directory_blocking(
    session: &SmbSession,
    parent_uri: &ResourceUri,
    smb_path: &str,
    include_hidden: bool,
    cancel: &ListCancellation,
    mut on_entry: impl FnMut(FileEntry) -> Result<(), VfsError>,
) -> Result<(), VfsError> {
    let path_arg = if smb_path.trim_start_matches('/').is_empty() {
        String::new()
    } else {
        format!("\"{}\"", smb_path.trim_end_matches('/'))
    };

    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!("ls {path_arg}"))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(map_smb_error(parent_uri, &stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if cancel.is_cancelled() {
            return Err(VfsError::cancelled(parent_uri));
        }

        // smbclient ls output: "  filename   D   0  Mon Jan 1 00:00:00 2024"
        // or: "  .   D   0  ..."
        // or: "  ..   D   0  ..."
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("blocks") {
            continue;
        }

        let parts: Vec<&str> = trimmed.splitn(2, ' ').collect();
        let name = parts[0].trim();
        if name.is_empty() || name == "." || name == ".." {
            continue;
        }
        if !include_hidden && name.starts_with('.') {
            continue;
        }

        let is_dir = line.contains(" D ");

        let child_path = join_remote_path(smb_path, name);
        let profile_id = parent_uri
            .remote_authority()
            .ok_or_else(|| VfsError::invalid_uri(parent_uri.as_str(), "missing profile id"))?;
        let child_uri = ResourceUri::from_remote_profile("smb", profile_id, &child_path)?;

        let kind = if is_dir {
            FileKind::Directory
        } else {
            FileKind::File
        };

        let extension = if kind == FileKind::File {
            name.rsplit('.')
                .next()
                .filter(|part| *part != name)
                .map(str::to_string)
        } else {
            None
        };

        let capabilities = if is_dir {
            EntryCapabilities::writable_directory()
        } else {
            EntryCapabilities::writable_file()
        };

        on_entry(FileEntry {
            uri: child_uri,
            name: name.to_string(),
            extension,
            kind,
            size: None,
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            is_placeholder: false,
            symlink_target: None,
            provider_id: ProviderId::new("smb"),
            capabilities,
            permissions: None,
            owner: None,
        })?;
    }

    Ok(())
}

pub fn mkdir_blocking(
    session: &SmbSession,
    uri: &ResourceUri,
    smb_path: &str,
) -> Result<(), VfsError> {
    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!("mkdir \"{}\"", smb_path.trim_start_matches('/')))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;
    if !output.status.success() {
        return Err(map_smb_error(uri, &String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
}

pub fn remove_file_blocking(
    session: &SmbSession,
    uri: &ResourceUri,
    smb_path: &str,
) -> Result<(), VfsError> {
    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!("rm \"{}\"", smb_path.trim_start_matches('/')))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;
    if !output.status.success() {
        return Err(map_smb_error(uri, &String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
}

pub fn remove_dir_blocking(
    session: &SmbSession,
    uri: &ResourceUri,
    smb_path: &str,
) -> Result<(), VfsError> {
    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!("rmdir \"{}\"", smb_path.trim_start_matches('/')))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;
    if !output.status.success() {
        return Err(map_smb_error(uri, &String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
}

pub fn rename_blocking(
    session: &SmbSession,
    from_uri: &ResourceUri,
    from_path: &str,
    to_path: &str,
) -> Result<(), VfsError> {
    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!(
            "rename \"{}\" \"{}\"",
            from_path.trim_start_matches('/'),
            to_path.trim_start_matches('/')
        ))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;
    if !output.status.success() {
        return Err(map_smb_error(
            from_uri,
            &String::from_utf8_lossy(&output.stderr),
        ));
    }
    Ok(())
}

pub fn create_empty_file_blocking(
    session: &SmbSession,
    uri: &ResourceUri,
    smb_path: &str,
) -> Result<(), VfsError> {
    // smbclient put from /dev/null
    let output = session
        .smbclient()
        .arg("-c")
        .arg(format!(
            "put /dev/null \"{}\"",
            smb_path.trim_start_matches('/')
        ))
        .output()
        .map_err(|e| VfsError::internal(&e.to_string()))?;
    if !output.status.success() {
        return Err(map_smb_error(uri, &String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
}

pub fn copy_file_blocking(
    _session: &SmbSession,
    _source_uri: &ResourceUri,
    _source_path: &str,
    _dest_uri: &ResourceUri,
    _dest_path: &str,
    _on_progress: &mut (dyn FnMut(u64) + Send),
) -> Result<u64, VfsError> {
    // SMB copy is not directly supported by smbclient CLI
    // Would need: download + upload approach
    Err(VfsError::UnsupportedOperation {
        scheme: "smb".to_string(),
        operation: "copy_file (not supported via smbclient CLI)",
    })
}

pub fn read_file_prefix_blocking(
    _session: &SmbSession,
    _source_uri: &ResourceUri,
    _source_path: &str,
    _max_bytes: u64,
) -> Result<Vec<u8>, VfsError> {
    // Would need: smbclient get to temp file + read prefix
    Err(VfsError::UnsupportedOperation {
        scheme: "smb".to_string(),
        operation: "read_file_prefix (not supported via smbclient CLI)",
    })
}

pub fn join_remote_path(base: &str, name: &str) -> String {
    if base.ends_with('/') {
        format!("{base}{name}")
    } else {
        format!("{base}/{name}")
    }
}

pub fn map_smb_error(uri: &ResourceUri, message: &str) -> VfsError {
    let msg = message.to_lowercase();
    if msg.contains("not found")
        || msg.contains("no such file")
        || msg.contains("no_such_file")
        || msg.contains("object_name_not_found")
    {
        VfsError::not_found(uri)
    } else if msg.contains("permission denied")
        || msg.contains("access denied")
        || msg.contains("access_denied")
    {
        VfsError::permission_denied(uri)
    } else {
        VfsError::Internal {
            message: message.to_string(),
        }
    }
}
