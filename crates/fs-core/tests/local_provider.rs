use std::fs;
use std::io::Write;

use fs_core::LocalFsProvider;
use vfs::{FileKind, ListCancellation, ListOptions, ListSessionId, ResourceUri, VfsProvider};

#[tokio::test]
async fn stat_returns_file_metadata() {
    let temp = tempfile::tempdir().unwrap();
    let file_path = temp.path().join("note.txt");
    let mut file = fs::File::create(&file_path).unwrap();

    writeln!(file, "hello").unwrap();

    let uri = ResourceUri::from_local_path(&file_path).unwrap();
    let provider = LocalFsProvider::new();
    let entry = provider.stat(&uri).await.unwrap();

    assert_eq!(entry.name, "note.txt");
    assert_eq!(entry.extension, Some("txt".to_string()));
    assert_eq!(entry.kind, FileKind::File);
    assert!(entry.size.unwrap() > 0);
    assert!(entry.capabilities.can_read);
}

#[tokio::test]
async fn stat_returns_directory_metadata() {
    let temp = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(temp.path()).unwrap();
    let provider = LocalFsProvider::new();
    let entry = provider.stat(&uri).await.unwrap();

    assert_eq!(entry.kind, FileKind::Directory);
    assert!(entry.capabilities.can_list);
}

#[tokio::test]
async fn stat_returns_not_found_for_missing_path() {
    let temp = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(&temp.path().join("missing")).unwrap();
    let provider = LocalFsProvider::new();
    let error = provider.stat(&uri).await.unwrap_err();

    assert_eq!(error.code(), "not_found");
}

#[tokio::test]
async fn list_emits_batches_and_final_completion() {
    let temp = tempfile::tempdir().unwrap();

    fs::write(temp.path().join("a.txt"), "").unwrap();
    fs::write(temp.path().join("b.txt"), "").unwrap();
    fs::write(temp.path().join("c.txt"), "").unwrap();

    let uri = ResourceUri::from_local_path(temp.path()).unwrap();
    let provider = LocalFsProvider::new();
    let (sender, mut receiver) = tokio::sync::mpsc::channel(4);

    provider
        .list(
            &uri,
            ListOptions {
                session_id: ListSessionId::new("session-1"),
                request_id: "request-1".to_string(),
                batch_size: 2,
                include_hidden: true,
                cancel: ListCancellation::new(),
            },
            sender,
        )
        .await
        .unwrap();

    let first = receiver.recv().await.unwrap();
    let second = receiver.recv().await.unwrap();

    assert_eq!(first.request_id, "request-1");
    assert_eq!(first.entries.len(), 2);
    assert!(!first.is_complete);
    assert_eq!(second.entries.len(), 1);
    assert!(second.is_complete);
}

#[tokio::test]
async fn list_streams_without_collecting_all_entries_first() {
    let temp = tempfile::tempdir().unwrap();

    for index in 0..10_000 {
        fs::write(temp.path().join(format!("file-{index:05}.txt")), "").unwrap();
    }

    let uri = ResourceUri::from_local_path(temp.path()).unwrap();
    let provider = LocalFsProvider::new();
    let (sender, mut receiver) = tokio::sync::mpsc::channel(1);
    let task = tokio::spawn(async move {
        provider
            .list(
                &uri,
                ListOptions {
                    session_id: ListSessionId::new("large-session"),
                    request_id: "request-large".to_string(),
                    batch_size: 128,
                    include_hidden: true,
                    cancel: ListCancellation::new(),
                },
                sender,
            )
            .await
    });
    let first = receiver.recv().await.unwrap();

    assert_eq!(first.entries.len(), 128);
    assert!(!first.is_complete);

    drop(receiver);
    let _ = task.await;
}

#[cfg(unix)]
#[tokio::test]
async fn list_returns_permission_denied_for_inaccessible_directory() {
    use std::os::unix::fs::PermissionsExt;

    let temp = tempfile::tempdir().unwrap();
    let blocked = temp.path().join("blocked");

    fs::create_dir(&blocked).unwrap();
    fs::set_permissions(&blocked, fs::Permissions::from_mode(0o000)).unwrap();

    let uri = ResourceUri::from_local_path(&blocked).unwrap();
    let provider = LocalFsProvider::new();
    let (sender, _receiver) = tokio::sync::mpsc::channel(1);
    let error = provider
        .list(
            &uri,
            ListOptions {
                session_id: ListSessionId::new("permission-denied"),
                request_id: "request-denied".to_string(),
                batch_size: 2,
                include_hidden: true,
                cancel: ListCancellation::new(),
            },
            sender,
        )
        .await
        .unwrap_err();

    fs::set_permissions(&blocked, fs::Permissions::from_mode(0o700)).unwrap();

    assert_eq!(error.code(), "permission_denied");
}

#[tokio::test]
async fn list_preserves_unicode_names() {
    let temp = tempfile::tempdir().unwrap();

    fs::write(temp.path().join("файл 🚀.txt"), "").unwrap();

    let uri = ResourceUri::from_local_path(temp.path()).unwrap();
    let provider = LocalFsProvider::new();
    let (sender, mut receiver) = tokio::sync::mpsc::channel(1);

    provider
        .list(
            &uri,
            ListOptions {
                session_id: ListSessionId::new("unicode"),
                request_id: "request-unicode".to_string(),
                batch_size: 4,
                include_hidden: true,
                cancel: ListCancellation::new(),
            },
            sender,
        )
        .await
        .unwrap();

    let batch = receiver.recv().await.unwrap();

    assert_eq!(batch.entries[0].name, "файл 🚀.txt");
}

#[tokio::test]
async fn list_stops_when_cancelled() {
    let temp = tempfile::tempdir().unwrap();

    for index in 0..512 {
        fs::write(temp.path().join(format!("file-{index:04}.txt")), "").unwrap();
    }

    let uri = ResourceUri::from_local_path(temp.path()).unwrap();
    let provider = LocalFsProvider::new();
    let cancel = ListCancellation::new();
    let token = cancel.clone();
    let (sender, mut receiver) = tokio::sync::mpsc::channel(4);
    let task = tokio::spawn(async move {
        provider
            .list(
                &uri,
                ListOptions {
                    session_id: ListSessionId::new("cancel-session"),
                    request_id: "cancel-request".to_string(),
                    batch_size: 32,
                    include_hidden: true,
                    cancel,
                },
                sender,
            )
            .await
    });

    let _ = receiver.recv().await;
    token.cancel();

    let error = task.await.unwrap().unwrap_err();
    assert_eq!(error.code(), "cancelled");
}

#[tokio::test]
async fn create_directory_creates_a_local_directory() {
    let temp = tempfile::tempdir().unwrap();
    let target_path = temp.path().join("new-folder");
    let target = ResourceUri::from_local_path(&target_path).unwrap();

    LocalFsProvider::new()
        .create_directory(&target)
        .await
        .unwrap();

    assert!(target_path.is_dir());
}

#[tokio::test]
async fn create_directory_creates_nested_parents() {
    let temp = tempfile::tempdir().unwrap();
    let target_path = temp.path().join("a/b/c");
    let target = ResourceUri::from_local_path(&target_path).unwrap();

    LocalFsProvider::new()
        .create_directory(&target)
        .await
        .unwrap();

    assert!(target_path.is_dir());
}

#[tokio::test]
async fn create_file_creates_an_empty_local_file() {
    let temp = tempfile::tempdir().unwrap();
    let target_path = temp.path().join("new-file.txt");
    let target = ResourceUri::from_local_path(&target_path).unwrap();

    LocalFsProvider::new().create_file(&target).await.unwrap();

    assert!(target_path.is_file());
    assert_eq!(fs::metadata(&target_path).unwrap().len(), 0);
}

#[tokio::test]
async fn rename_moves_a_file_in_place() {
    let temp = tempfile::tempdir().unwrap();
    let from_path = temp.path().join("a.txt");
    fs::write(&from_path, b"hello").unwrap();
    let from = ResourceUri::from_local_path(&from_path).unwrap();
    let to_path = temp.path().join("b.txt");
    let to = ResourceUri::from_local_path(&to_path).unwrap();

    LocalFsProvider::new().rename(&from, &to).await.unwrap();

    assert!(!from_path.exists());
    assert_eq!(fs::read(&to_path).unwrap(), b"hello");
}

#[tokio::test]
async fn remove_deletes_a_file() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("doomed.txt");
    fs::write(&path, b"x").unwrap();
    let uri = ResourceUri::from_local_path(&path).unwrap();

    LocalFsProvider::new().remove(&uri, false).await.unwrap();

    assert!(!path.exists());
}

#[tokio::test]
async fn remove_recursive_deletes_a_tree() {
    let temp = tempfile::tempdir().unwrap();
    let root_path = temp.path().join("tree");
    fs::create_dir_all(root_path.join("nested")).unwrap();
    fs::write(root_path.join("nested/a.txt"), b"x").unwrap();
    let root = ResourceUri::from_local_path(&root_path).unwrap();

    LocalFsProvider::new().remove(&root, true).await.unwrap();

    assert!(!root_path.exists());
}

#[tokio::test]
async fn remove_returns_not_found_for_missing_path() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("missing.txt");
    let uri = ResourceUri::from_local_path(&path).unwrap();

    let error = LocalFsProvider::new()
        .remove(&uri, false)
        .await
        .unwrap_err();
    assert_eq!(error.code(), "not_found");
}

#[tokio::test]
async fn copy_file_streams_local_bytes() {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    let temp = tempfile::tempdir().unwrap();
    let source_path = temp.path().join("src.bin");
    let bytes = vec![7_u8; 200_000];
    fs::write(&source_path, &bytes).unwrap();
    let source = ResourceUri::from_local_path(&source_path).unwrap();
    let destination_path = temp.path().join("dst.bin");
    let destination = ResourceUri::from_local_path(&destination_path).unwrap();

    let observed = Arc::new(AtomicU64::new(0));
    let observed_clone = observed.clone();
    let total = LocalFsProvider::new()
        .copy_file(
            &source,
            &destination,
            Box::new(move |bytes_so_far| {
                observed_clone.store(bytes_so_far, Ordering::SeqCst);
            }),
        )
        .await
        .unwrap();

    assert_eq!(total, bytes.len() as u64);
    assert_eq!(observed.load(Ordering::SeqCst), bytes.len() as u64);
    assert_eq!(fs::read(&destination_path).unwrap(), bytes);
}

#[tokio::test]
async fn read_file_prefix_returns_first_n_bytes() {
    let temp = tempfile::tempdir().unwrap();
    let target_path = temp.path().join("data.txt");
    fs::write(&target_path, b"abcdefghij").unwrap();
    let target = ResourceUri::from_local_path(&target_path).unwrap();

    let prefix = LocalFsProvider::new()
        .read_file_prefix(&target, 4)
        .await
        .unwrap();

    assert_eq!(prefix, b"abcd");
}

#[tokio::test]
async fn capabilities_declares_read_write() {
    let caps = LocalFsProvider::new().capabilities();
    assert!(caps.can_read);
    assert!(caps.can_write);
    assert!(caps.can_delete);
}
