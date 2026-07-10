use std::io::{Read, Write};
use std::path::Path;

use ssh2::{OpenFlags, OpenType, RenameFlags};
use vfs::VfsError;

use crate::connector::{map_ssh_error, map_stat_error, SftpSession};

pub const TRANSFER_CHUNK_SIZE: usize = 256 * 1024;

pub fn mkdir_blocking(
    session: &SftpSession,
    uri: &vfs::ResourceUri,
    remote_path: &str,
) -> Result<(), VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    sftp.mkdir(Path::new(remote_path), 0o755)
        .map_err(|error| map_stat_error(uri, error))?;
    Ok(())
}

pub fn remove_file_blocking(
    session: &SftpSession,
    uri: &vfs::ResourceUri,
    remote_path: &str,
) -> Result<(), VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    sftp.unlink(Path::new(remote_path))
        .map_err(|error| map_stat_error(uri, error))?;
    Ok(())
}

pub fn remove_dir_blocking(
    session: &SftpSession,
    uri: &vfs::ResourceUri,
    remote_path: &str,
) -> Result<(), VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    sftp.rmdir(Path::new(remote_path))
        .map_err(|error| map_stat_error(uri, error))?;
    Ok(())
}

pub fn rename_blocking(
    session: &SftpSession,
    from_uri: &vfs::ResourceUri,
    from_path: &str,
    to_path: &str,
) -> Result<(), VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    sftp.rename(
        Path::new(from_path),
        Path::new(to_path),
        Some(RenameFlags::empty()),
    )
    .map_err(|error| map_stat_error(from_uri, error))?;
    Ok(())
}

pub fn create_empty_file_blocking(
    session: &SftpSession,
    uri: &vfs::ResourceUri,
    remote_path: &str,
) -> Result<(), VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    let mut file = sftp
        .open_mode(
            Path::new(remote_path),
            OpenFlags::WRITE | OpenFlags::EXCLUSIVE,
            0o644,
            OpenType::File,
        )
        .map_err(|error| map_stat_error(uri, error))?;
    file.flush()
        .map_err(|error| VfsError::internal(&error.to_string()))?;
    Ok(())
}

pub fn upload_file_blocking(
    session: &SftpSession,
    dest_uri: &vfs::ResourceUri,
    dest_path: &str,
    mut source: impl Read,
    mut on_chunk: impl FnMut(u64),
) -> Result<u64, VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    let staging_path = remote_staging_path(dest_path);
    let mut dest = sftp
        .open_mode(
            Path::new(&staging_path),
            OpenFlags::WRITE | OpenFlags::EXCLUSIVE,
            0o600,
            OpenType::File,
        )
        .map_err(|error| map_stat_error(dest_uri, error))?;
    let mut buffer = vec![0_u8; TRANSFER_CHUNK_SIZE];
    let mut total = 0_u64;

    let transfer = (|| {
        loop {
            let read = source
                .read(&mut buffer)
                .map_err(|error| VfsError::internal(&error.to_string()))?;
            if read == 0 {
                break;
            }
            dest.write_all(&buffer[..read])
                .map_err(|error| VfsError::internal(&error.to_string()))?;
            total += read as u64;
            on_chunk(total);
        }

        dest.flush()
            .map_err(|error| VfsError::internal(&error.to_string()))?;
        drop(dest);
        sftp.rename(
            Path::new(&staging_path),
            Path::new(dest_path),
            Some(RenameFlags::empty()),
        )
        .map_err(|error| map_stat_error(dest_uri, error))?;
        Ok(total)
    })();

    if transfer.is_err() {
        let _ = sftp.unlink(Path::new(&staging_path));
    }
    transfer
}

pub(crate) fn remote_staging_path(destination: &str) -> String {
    let parent = destination
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    let name = format!(".fileoctopus-upload-{}.tmp", uuid::Uuid::new_v4());
    if parent.is_empty() {
        format!("/{name}")
    } else if parent.ends_with('/') {
        format!("{parent}{name}")
    } else {
        format!("{parent}/{name}")
    }
}

pub fn download_file_blocking(
    session: &SftpSession,
    source_uri: &vfs::ResourceUri,
    source_path: &str,
    mut dest: impl Write,
    mut on_chunk: impl FnMut(u64),
) -> Result<u64, VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    let mut source = sftp
        .open(Path::new(source_path))
        .map_err(|error| map_stat_error(source_uri, error))?;
    let mut buffer = vec![0_u8; TRANSFER_CHUNK_SIZE];
    let mut total = 0_u64;

    loop {
        let read = source
            .read(&mut buffer)
            .map_err(|error| VfsError::internal(&error.to_string()))?;
        if read == 0 {
            break;
        }
        dest.write_all(&buffer[..read])
            .map_err(|error| VfsError::internal(&error.to_string()))?;
        total += read as u64;
        on_chunk(total);
    }

    Ok(total)
}

pub fn read_file_prefix_blocking(
    session: &SftpSession,
    source_uri: &vfs::ResourceUri,
    source_path: &str,
    max_bytes: u64,
) -> Result<Vec<u8>, VfsError> {
    let guard = session.lock_session().map_err(VfsError::from)?;
    let sftp = guard.sftp().map_err(map_ssh_error)?;
    let mut source = sftp
        .open(Path::new(source_path))
        .map_err(|error| map_stat_error(source_uri, error))?;
    let mut buffer = vec![0_u8; TRANSFER_CHUNK_SIZE.min(max_bytes as usize)];
    let mut output = Vec::with_capacity(buffer.len());

    while output.len() < max_bytes as usize {
        let remaining = max_bytes as usize - output.len();
        let read_len = buffer.len().min(remaining);
        if read_len == 0 {
            break;
        }
        let read = source
            .read(&mut buffer[..read_len])
            .map_err(|error| VfsError::internal(&error.to_string()))?;
        if read == 0 {
            break;
        }
        output.extend_from_slice(&buffer[..read]);
    }

    Ok(output)
}

pub fn capabilities_from_perm(perm: Option<u32>, kind: vfs::FileKind) -> vfs::EntryCapabilities {
    let Some(perm) = perm else {
        return match kind {
            vfs::FileKind::Directory => vfs::EntryCapabilities::read_only_directory(),
            _ => vfs::EntryCapabilities::read_only_file(),
        };
    };

    let owner_write = perm & 0o200 != 0;
    let owner_read = perm & 0o400 != 0;
    let owner_exec = perm & 0o100 != 0;

    match kind {
        vfs::FileKind::Directory => {
            if owner_write && owner_read && owner_exec {
                vfs::EntryCapabilities::writable_directory()
            } else {
                vfs::EntryCapabilities::read_only_directory()
            }
        }
        vfs::FileKind::Symlink => vfs::EntryCapabilities::read_only_file(),
        _ => {
            if owner_write && owner_read {
                vfs::EntryCapabilities::writable_file()
            } else {
                vfs::EntryCapabilities::read_only_file()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staging_upload_stays_in_destination_directory() {
        let nested = remote_staging_path("/home/user/file.txt");
        assert!(nested.starts_with("/home/user/.fileoctopus-upload-"));
        assert!(nested.ends_with(".tmp"));

        let root = remote_staging_path("/file.txt");
        assert!(root.starts_with("/.fileoctopus-upload-"));
        assert!(root.ends_with(".tmp"));
    }
}
