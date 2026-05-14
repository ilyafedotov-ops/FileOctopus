use std::fs;
use std::io::Write;

use fs_core::LocalFsProvider;
use vfs::{FileKind, ListOptions, ListSessionId, ResourceUri, VfsProvider};

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
                batch_size: 2,
                include_hidden: true,
            },
            sender,
        )
        .await
        .unwrap();

    let first = receiver.recv().await.unwrap();
    let second = receiver.recv().await.unwrap();

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
                    batch_size: 128,
                    include_hidden: true,
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
