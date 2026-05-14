use test_support::{generate_test_tree, TestTreeOptions};

#[test]
fn generates_and_cleans_test_tree() {
    let root = std::env::temp_dir().join(format!("fileoctopus-test-tree-{}", std::process::id()));
    let mut options = TestTreeOptions::new(root.clone());

    options.files = 8;
    options.dirs = 3;
    options.max_depth = 2;

    let summary = generate_test_tree(&options).unwrap();

    assert_eq!(summary.files_created, 8);
    assert_eq!(summary.dirs_created, 3);
    assert!(root.exists());

    options.cleanup = true;
    let cleanup = generate_test_tree(&options).unwrap();

    assert!(cleanup.cleaned);
    assert!(!root.exists());
}
