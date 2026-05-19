use std::path::Path;

use platform::{cmd_path_is_safe, path_contains_cmd_metacharacters};

#[test]
fn cmd_path_rejects_shell_metacharacters() {
    assert!(path_contains_cmd_metacharacters(Path::new(
        r"C:\tmp\foo & bar"
    )));
    assert!(path_contains_cmd_metacharacters(Path::new(
        r"C:\tmp\foo|bar"
    )));
    assert!(path_contains_cmd_metacharacters(Path::new(
        r"C:\tmp\foo>bar"
    )));
    assert!(path_contains_cmd_metacharacters(Path::new(
        r"C:\tmp\foo%bar"
    )));
}

#[test]
fn cmd_path_allows_normal_paths() {
    assert!(!path_contains_cmd_metacharacters(Path::new(
        r"C:\Users\dev\Projects"
    )));
    assert!(!path_contains_cmd_metacharacters(Path::new(
        r"C:\tmp\foo bar"
    )));
    assert!(cmd_path_is_safe(Path::new(r"C:\Users\dev\Projects")));
}
