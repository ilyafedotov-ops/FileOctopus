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
