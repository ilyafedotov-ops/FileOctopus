use std::process::Command;

use git_intel::{GitError, GitFileStatus, GitService};
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
        ResourceUri::from_local_path(&repo.path()).unwrap()
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

    let uri = ResourceUri::from_local_path(&repo.path()).unwrap();
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

#[tokio::test]
async fn status_for_repository_lists_reviewable_changes_without_ignored_files() {
    let repo = TestRepo::init();
    repo.write("modified.txt", "base");
    repo.write("deleted.txt", "base");
    repo.write("old-name.txt", "base");
    repo.write(".gitignore", "ignored.txt\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);

    repo.write("modified.txt", "changed");
    std::fs::remove_file(repo.path().join("deleted.txt")).unwrap();
    repo.git(["mv", "old-name.txt", "new-name.txt"]);
    repo.write("untracked.txt", "loose");
    repo.write("ignored.txt", "ignored");

    let status = GitService::new()
        .status_for_repository(&repo.uri("modified.txt"))
        .await
        .unwrap();

    let paths = status
        .files
        .iter()
        .map(|file| (file.repo_relative_path.as_str(), file.status))
        .collect::<Vec<_>>();

    assert_eq!(
        status.repo.as_ref().unwrap().branch.as_deref(),
        Some("main")
    );
    assert!(paths.contains(&("modified.txt", GitFileStatus::Modified)));
    assert!(paths.contains(&("deleted.txt", GitFileStatus::Deleted)));
    assert!(paths.contains(&("new-name.txt", GitFileStatus::Renamed)));
    assert!(paths.contains(&("untracked.txt", GitFileStatus::Untracked)));
    assert!(!paths.iter().any(|(path, _)| *path == "ignored.txt"));

    let renamed = status
        .files
        .iter()
        .find(|file| file.repo_relative_path == "new-name.txt")
        .unwrap();
    assert_eq!(
        renamed.previous_repo_relative_path.as_deref(),
        Some("old-name.txt")
    );
    assert_eq!(
        renamed.previous_uri.as_ref(),
        Some(&repo.uri("old-name.txt"))
    );
}

#[tokio::test]
async fn status_for_repository_handles_unborn_repository() {
    let repo = TestRepo::init();
    repo.write("new.txt", "hello");

    let status = GitService::new()
        .status_for_repository(&repo.uri("new.txt"))
        .await
        .unwrap();

    assert_eq!(status.repo.as_ref().unwrap().head_short, None);
    assert_eq!(status.files.len(), 1);
    assert_eq!(status.files[0].status, GitFileStatus::Untracked);
    assert_eq!(status.files[0].repo_relative_path, "new.txt");
}

#[tokio::test]
async fn status_for_repository_returns_empty_outside_repo() {
    let dir = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(dir.path()).unwrap();

    let status = GitService::new().status_for_repository(&uri).await.unwrap();

    assert_eq!(status.repo, None);
    assert!(status.files.is_empty());
}

#[tokio::test]
async fn history_returns_recent_commits_newest_first_with_merge_metadata() {
    let repo = TestRepo::init();
    repo.write("base.txt", "base\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.git(["switch", "-c", "topic"]);
    repo.write("topic.txt", "topic\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "topic commit"]);
    repo.git(["switch", "main"]);
    repo.write("main.txt", "main\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "main commit"]);
    repo.git(["merge", "--no-ff", "topic", "-m", "merge topic"]);

    let history = GitService::new()
        .history(&repo.uri("base.txt"), Some(3))
        .await
        .unwrap();

    assert_eq!(
        history.repo.as_ref().unwrap().branch.as_deref(),
        Some("main")
    );
    assert_eq!(history.commits.len(), 3);
    assert_eq!(history.commits[0].subject, "merge topic");
    assert_eq!(history.commits[0].parents.len(), 2);
    assert_eq!(history.commits[1].subject, "main commit");
    assert_eq!(history.commits[2].subject, "topic commit");
    assert_eq!(history.commits[0].short_hash.len(), 7);
    assert_eq!(history.commits[0].author_name, "FileOctopus Test");
}

#[tokio::test]
async fn history_caps_max_count_and_handles_empty_repositories() {
    let repo = TestRepo::init();

    let unborn = GitService::new()
        .history(
            &ResourceUri::from_local_path(&repo.path()).unwrap(),
            Some(200),
        )
        .await
        .unwrap();

    assert!(unborn.commits.is_empty());

    for index in 0..120 {
        repo.write(&format!("file-{index}.txt"), "content\n");
        repo.git(["add", "."]);
        repo.git(["commit", "-m", &format!("commit {index}")]);
    }

    let history = GitService::new()
        .history(
            &ResourceUri::from_local_path(&repo.path()).unwrap(),
            Some(200),
        )
        .await
        .unwrap();

    assert_eq!(history.commits.len(), 100);
    assert_eq!(history.commits[0].subject, "commit 119");
}

#[tokio::test]
async fn history_returns_empty_outside_repo() {
    let dir = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(dir.path()).unwrap();

    let history = GitService::new().history(&uri, None).await.unwrap();

    assert_eq!(history.repo, None);
    assert!(history.commits.is_empty());
}

#[tokio::test]
async fn branches_lists_local_and_remote_refs_with_active_marker() {
    let repo = TestRepo::init();
    repo.write("base.txt", "base\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.git([
        "remote",
        "add",
        "origin",
        "https://example.invalid/repo.git",
    ]);
    repo.git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    repo.git(["branch", "--set-upstream-to=origin/main", "main"]);
    repo.git(["branch", "feature/example"]);

    let branches = GitService::new()
        .branches(&ResourceUri::from_local_path(&repo.path()).unwrap())
        .await
        .unwrap();

    let main = branches
        .branches
        .iter()
        .find(|branch| branch.full_name == "refs/heads/main")
        .unwrap();
    let remote = branches
        .branches
        .iter()
        .find(|branch| branch.full_name == "refs/remotes/origin/main")
        .unwrap();

    assert_eq!(main.name, "main");
    assert_eq!(main.kind, "local");
    assert!(main.is_current);
    assert_eq!(main.upstream.as_deref(), Some("origin/main"));
    assert_eq!(main.subject, "initial");
    assert_eq!(remote.name, "origin/main");
    assert_eq!(remote.kind, "remote");
    assert!(!remote.is_current);
}

#[tokio::test]
async fn branches_returns_empty_outside_repo() {
    let dir = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(dir.path()).unwrap();

    let branches = GitService::new().branches(&uri).await.unwrap();

    assert_eq!(branches.repo, None);
    assert!(branches.branches.is_empty());
}

#[tokio::test]
async fn worktrees_lists_main_linked_and_detached_worktrees() {
    let repo = TestRepo::init();
    repo.write("base.txt", "base\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    let linked_dir = tempfile::tempdir().unwrap();
    let detached_dir = tempfile::tempdir().unwrap();
    let linked_path = linked_dir.path().join("linked");
    let detached_path = detached_dir.path().join("detached");
    repo.git([
        "worktree",
        "add",
        linked_path.to_str().unwrap(),
        "-b",
        "linked-branch",
    ]);
    repo.git([
        "worktree",
        "add",
        "--detach",
        detached_path.to_str().unwrap(),
        "HEAD",
    ]);

    let worktrees = GitService::new()
        .worktrees(&ResourceUri::from_local_path(&repo.path()).unwrap())
        .await
        .unwrap();

    let main = worktrees
        .worktrees
        .iter()
        .find(|worktree| worktree.path_uri == ResourceUri::from_local_path(&repo.path()).unwrap())
        .unwrap();
    let linked = worktrees
        .worktrees
        .iter()
        .find(|worktree| worktree.branch.as_deref() == Some("linked-branch"))
        .unwrap();
    let detached = worktrees
        .worktrees
        .iter()
        .find(|worktree| worktree.detached)
        .unwrap();

    assert_eq!(main.branch.as_deref(), Some("main"));
    assert!(!main.detached);
    assert_eq!(
        linked.path_uri,
        ResourceUri::from_local_path(&linked_path.canonicalize().unwrap()).unwrap()
    );
    assert_eq!(
        detached.path_uri,
        ResourceUri::from_local_path(&detached_path.canonicalize().unwrap()).unwrap()
    );
    assert!(detached.branch.is_none());
}

#[tokio::test]
async fn worktrees_returns_empty_outside_repo() {
    let dir = tempfile::tempdir().unwrap();
    let uri = ResourceUri::from_local_path(dir.path()).unwrap();

    let worktrees = GitService::new().worktrees(&uri).await.unwrap();

    assert_eq!(worktrees.repo, None);
    assert!(worktrees.worktrees.is_empty());
}

#[tokio::test]
async fn read_only_repository_views_reject_remote_uris() {
    let uri = ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/path/repo").unwrap();
    let service = GitService::new();

    assert!(matches!(
        service.history(&uri, None).await.unwrap_err(),
        GitError::UnsupportedProvider
    ));
    assert!(matches!(
        service.branches(&uri).await.unwrap_err(),
        GitError::UnsupportedProvider
    ));
    assert!(matches!(
        service.worktrees(&uri).await.unwrap_err(),
        GitError::UnsupportedProvider
    ));
}

#[tokio::test]
async fn diff_file_returns_worktree_hunks_for_modified_file() {
    let repo = TestRepo::init();
    repo.write("tracked.txt", "one\ntwo\nthree\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.write("tracked.txt", "one\nTWO\nthree\nfour\n");

    let diff = GitService::new()
        .diff_file(&repo.uri("tracked.txt"), Some(512 * 1024))
        .await
        .unwrap();

    assert_eq!(diff.file.status, GitFileStatus::Modified);
    assert!(!diff.binary);
    assert_eq!(diff.unsupported_reason, None);
    assert_eq!(diff.old_line_count, 3);
    assert_eq!(diff.new_line_count, 4);
    assert!(diff
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .any(|line| line.kind == "delete" && line.content == "two\n"));
    assert!(diff
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .any(|line| line.kind == "insert" && line.content == "TWO\n"));
}

#[tokio::test]
async fn diff_file_represents_untracked_file_as_added_lines() {
    let repo = TestRepo::init();
    repo.write("tracked.txt", "base\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.write("new.txt", "hello\nworld\n");

    let diff = GitService::new()
        .diff_file(&repo.uri("new.txt"), Some(512 * 1024))
        .await
        .unwrap();

    assert_eq!(diff.file.status, GitFileStatus::Untracked);
    assert_eq!(diff.old_line_count, 0);
    assert_eq!(diff.new_line_count, 2);
    assert!(diff
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .all(|line| line.kind == "insert"));
}

#[tokio::test]
async fn diff_file_represents_deleted_file_as_removed_lines() {
    let repo = TestRepo::init();
    repo.write("deleted.txt", "gone\naway\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    std::fs::remove_file(repo.path().join("deleted.txt")).unwrap();

    let diff = GitService::new()
        .diff_file(&repo.uri("deleted.txt"), Some(512 * 1024))
        .await
        .unwrap();

    assert_eq!(diff.file.status, GitFileStatus::Deleted);
    assert_eq!(diff.old_line_count, 2);
    assert_eq!(diff.new_line_count, 0);
    assert!(diff
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .all(|line| line.kind == "delete"));
}

#[tokio::test]
async fn diff_file_uses_previous_path_for_renamed_file() {
    let repo = TestRepo::init();
    repo.write("old-name.txt", "one\ntwo\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.git(["mv", "old-name.txt", "new-name.txt"]);
    repo.write("new-name.txt", "one\nTWO\n");

    let diff = GitService::new()
        .diff_file(&repo.uri("new-name.txt"), Some(512 * 1024))
        .await
        .unwrap();

    assert_eq!(diff.file.status, GitFileStatus::Renamed);
    assert_eq!(
        diff.file.previous_repo_relative_path.as_deref(),
        Some("old-name.txt")
    );
    assert_eq!(diff.old_label, "HEAD:old-name.txt");
    assert!(diff
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .any(|line| line.kind == "delete" && line.content == "two\n"));
    assert!(diff
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .any(|line| line.kind == "insert" && line.content == "TWO\n"));
}

#[tokio::test]
async fn diff_file_returns_binary_summary_without_hunks() {
    let repo = TestRepo::init();
    repo.write_bytes("asset.bin", &[0, 1, 2, 3]);
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.write_bytes("asset.bin", &[0, 1, 9, 3]);

    let diff = GitService::new()
        .diff_file(&repo.uri("asset.bin"), Some(512 * 1024))
        .await
        .unwrap();

    assert_eq!(diff.file.status, GitFileStatus::Modified);
    assert!(diff.binary);
    assert_eq!(diff.unsupported_reason.as_deref(), Some("binary"));
    assert!(diff.hunks.is_empty());
}

#[tokio::test]
async fn diff_file_returns_truncation_summary_for_oversized_files() {
    let repo = TestRepo::init();
    repo.write("large.txt", "small\n");
    repo.git(["add", "."]);
    repo.git(["commit", "-m", "initial"]);
    repo.write("large.txt", "line\nline\nline\n");

    let diff = GitService::new()
        .diff_file(&repo.uri("large.txt"), Some(8))
        .await
        .unwrap();

    assert!(diff.new_truncated);
    assert_eq!(diff.unsupported_reason.as_deref(), Some("file_too_large"));
    assert!(diff.hunks.is_empty());
}

#[tokio::test]
async fn diff_file_rejects_remote_uris() {
    let uri =
        ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/path/file.txt").unwrap();

    let error = GitService::new().diff_file(&uri, None).await.unwrap_err();

    assert!(matches!(error, GitError::UnsupportedProvider));
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

    fn path(&self) -> std::path::PathBuf {
        // git resolves work-tree paths through symlinks (e.g. on macOS
        // /var/folders/... → /private/var/folders/...), so the URIs it
        // returns canonicalise the temp dir. Tests compare against URIs we
        // build ourselves, so we must canonicalise here too.
        self.dir.path().canonicalize().unwrap()
    }

    fn write(&self, relative: &str, content: &str) {
        let path = self.path().join(relative);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, content).unwrap();
    }

    fn write_bytes(&self, relative: &str, content: &[u8]) {
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
