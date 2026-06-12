use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use fs_core::file_ops::plan_file_operation;
use fs_core::vfs_io::VfsFilesystem;
use vfs::{
    ConflictPolicy, DirectoryBatch, DirectorySink, EntryCapabilities, FileEntry, FileKind,
    FileOperationKind, FileOperationRequest, ListOptions, ProviderCapabilities, ProviderId,
    ResourceUri, VfsError, VfsProvider, VfsRegistry,
};

const PROFILE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

#[derive(Clone)]
struct MemoryRemoteProvider {
    entries: Arc<HashMap<String, FileEntry>>,
    children: Arc<HashMap<String, Vec<String>>>,
}

impl MemoryRemoteProvider {
    fn new() -> Self {
        let root = uri("/source");
        let nested = uri("/source/nested");
        let file = uri("/source/nested/file.txt");
        let destination = uri("/destination");
        let existing = uri("/destination/source");

        let entries = HashMap::from([
            (
                root.as_str().to_string(),
                entry(root, "source", FileKind::Directory, None),
            ),
            (
                nested.as_str().to_string(),
                entry(nested, "nested", FileKind::Directory, None),
            ),
            (
                file.as_str().to_string(),
                entry(file, "file.txt", FileKind::File, Some(7)),
            ),
            (
                destination.as_str().to_string(),
                entry(destination, "destination", FileKind::Directory, None),
            ),
            (
                existing.as_str().to_string(),
                entry(existing, "source", FileKind::Directory, None),
            ),
        ]);
        let children = HashMap::from([
            ("/source".to_string(), vec!["nested".to_string()]),
            ("/source/nested".to_string(), vec!["file.txt".to_string()]),
            ("/destination".to_string(), vec!["source".to_string()]),
        ]);

        Self {
            entries: Arc::new(entries),
            children: Arc::new(children),
        }
    }
}

#[async_trait]
impl VfsProvider for MemoryRemoteProvider {
    fn id(&self) -> ProviderId {
        ProviderId::new("memory-gdrive")
    }

    fn schemes(&self) -> &'static [&'static str] {
        &["gdrive"]
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::read_write()
    }

    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
        self.entries
            .get(uri.as_str())
            .cloned()
            .ok_or_else(|| VfsError::NotFound {
                uri: uri.as_str().to_string(),
            })
    }

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError> {
        let path = uri.remote_path().unwrap_or_default();
        let entries = self
            .children
            .get(&path)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|name| {
                ResourceUri::from_remote_profile("gdrive", PROFILE_ID, &join_remote(&path, &name))
            })
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .map(|child| self.stat_blocking(&child))
            .collect::<Result<Vec<_>, _>>()?;

        sink.send(DirectoryBatch {
            session_id: options.session_id,
            request_id: options.request_id,
            uri: uri.clone(),
            entries,
            batch_index: 0,
            is_complete: true,
            total_hint: None,
        })
        .await
        .map_err(|_| VfsError::Cancelled {
            uri: uri.as_str().to_string(),
        })
    }
}

impl MemoryRemoteProvider {
    fn stat_blocking(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError> {
        self.entries
            .get(uri.as_str())
            .cloned()
            .ok_or_else(|| VfsError::NotFound {
                uri: uri.as_str().to_string(),
            })
    }
}

#[test]
fn plans_same_scheme_remote_copy_through_registered_provider() {
    let registry = Arc::new(VfsRegistry::new());
    registry
        .register(Arc::new(MemoryRemoteProvider::new()))
        .unwrap();
    let vfs = VfsFilesystem::local_only(registry);

    let plan = plan_file_operation(
        &vfs,
        FileOperationRequest {
            kind: FileOperationKind::Copy,
            sources: vec![uri("/source")],
            destination: Some(uri("/destination")),
            new_name: None,
            conflict_policy: ConflictPolicy::Fail,
        },
    )
    .unwrap();

    assert_eq!(plan.total_items, 3);
    assert!(plan.items.iter().any(|item| {
        item.source.as_ref().map(ResourceUri::as_str)
            == Some("gdrive://550e8400-e29b-41d4-a716-446655440000/source/nested/file.txt")
            && item.destination.as_ref().map(ResourceUri::as_str)
                == Some(
                    "gdrive://550e8400-e29b-41d4-a716-446655440000/destination/source/nested/file.txt",
                )
            && item.size == Some(7)
    }));
    assert!(plan.conflicts.iter().any(|conflict| {
        conflict.destination.as_str()
            == "gdrive://550e8400-e29b-41d4-a716-446655440000/destination/source"
    }));
}

fn uri(path: &str) -> ResourceUri {
    ResourceUri::from_remote_profile("gdrive", PROFILE_ID, path).unwrap()
}

fn entry(uri: ResourceUri, name: &str, kind: FileKind, size: Option<u64>) -> FileEntry {
    FileEntry {
        uri,
        name: name.to_string(),
        extension: None,
        kind,
        size,
        modified_at: None,
        created_at: None,
        accessed_at: None,
        is_hidden: name.starts_with('.'),
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: ProviderId::new("memory-gdrive"),
        capabilities: match kind {
            FileKind::Directory => EntryCapabilities::writable_directory(),
            _ => EntryCapabilities::writable_file(),
        },
        permissions: None,
        owner: None,
    }
}

fn join_remote(base: &str, name: &str) -> String {
    if base.ends_with('/') {
        format!("{base}{name}")
    } else {
        format!("{base}/{name}")
    }
}
