use std::process::Command;

use git_intel::{GitFileStatus, GitService};
use vfs::ResourceUri;

#[tokio::test]
async fn discover_returns_branch_and_dirty_state_inside_repo() {
    let repo = TestRepo::init();
    repo.write("tracked.txt", "clean");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.write("tracked.txt", "dirty");

    let nested = repo.path().join("nested");
    std::fs::create_dir(&nested).unwrap();
    let uri = ResourceUri::from_local_path(&nested).unwrap();

    let info = GitService::new().discover(&uri).await.unwrap().unwrap();

    assert_eq!(
        info.root_uri,
        ResourceUri::from_local_path(repo.path()).unwrap()
    );
    assert_eq!(info.branch.as_deref(), Some("main"));
    assert_eq!(info.head_short.as_ref().map(String::len), Some(7));
    assert!(info.is_dirty);
}

#[tokio::test]
async fn discover_returns_none_outside_repo() {
    let dir = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(dir.path()).unwrap();

    let info = GitService::new().discover(&uri).await.unwrap();

    assert_eq!(info, None);
}

#[tokio::test]
async fn status_for_directory_maps_basic_file_states() {
    let repo = TestRepo::init();
    repo.write("modified.txt", "base");
    repo.write("deleted.txt", "base");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);

    repo.write("modified.txt", "changed");
    std::fs::remove_file(repo.path().join("deleted.txt")).unwrap();
    repo.write("added.txt", "new");
    repo.git(["add", "added.txt"]);
    repo.write("untracked.txt", "loose");
    repo.write(".gitignore", "ignored.txt\n");
    repo.write("ignored.txt", "ignored");

    let uri = ResourceUri::from_local_path(repo.path()).unwrap();
    let status = GitService::new().status_for_directory(&uri).await.unwrap();

    assert_eq!(
        status.entries.get(&repo.uri("modified.txt")),
        Some(&GitFileStatus::Modified)
    );
    assert_eq!(
        status.entries.get(&repo.uri("deleted.txt")),
        Some(&GitFileStatus::Deleted)
    );
    assert_eq!(
        status.entries.get(&repo.uri("added.txt")),
        Some(&GitFileStatus::Added)
    );
    assert_eq!(
        status.entries.get(&repo.uri("untracked.txt")),
        Some(&GitFileStatus::Untracked)
    );
    assert_eq!(
        status.entries.get(&repo.uri("ignored.txt")),
        Some(&GitFileStatus::Ignored)
    );
}

#[tokio::test]
async fn status_for_directory_limits_entries_to_requested_directory() {
    let repo = TestRepo::init();
    repo.write("root.txt", "base");
    repo.write("nested/child.txt", "base");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);

    repo.write("root.txt", "changed");
    repo.write("nested/child.txt", "changed");

    let uri = ResourceUri::from_local_path(&repo.path().join("nested")).unwrap();
    let status = GitService::new().status_for_directory(&uri).await.unwrap();

    assert_eq!(
        status.entries.get(&repo.uri("nested/child.txt")),
        Some(&GitFileStatus::Modified)
    );
    assert!(!status.entries.contains_key(&repo.uri("root.txt")));
}

struct TestRepo {
    dir: tempfile::TempDir,
}

impl TestRepo {
    fn init() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let repo = Self { dir };

        repo.git(["init", "-b", "main"]);
        repo.git(["config", "user.email", "test@example.invalid"]);
        repo.git(["config", "user.name", "FileOctopus Test"]);

        repo
    }

    fn path(&self) -> &std::path::Path {
        self.dir.path()
    }

    fn write(&self, relative: &str, content: &str) {
        let path = self.path().join(relative);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, content).unwrap();
    }

    fn uri(&self, relative: &str) -> ResourceUri {
        ResourceUri::from_local_path(&self.path().join(relative)).unwrap()
    }

    fn git<const N: usize>(&self, args: [&str; N]) {
        let output = Command::new("git")
            .args(args)
            .current_dir(self.path())
            .output()
            .unwrap();

        assert!(
            output.status.success(),
            "git command failed: {}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
