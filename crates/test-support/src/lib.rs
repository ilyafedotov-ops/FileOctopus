use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestTreeOptions {
    pub root: PathBuf,
    pub files: usize,
    pub dirs: usize,
    pub max_depth: usize,
    pub file_size: usize,
    pub cleanup: bool,
}

impl TestTreeOptions {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            files: 0,
            dirs: 0,
            max_depth: 1,
            file_size: 0,
            cleanup: false,
        }
    }
}

pub fn generate_test_tree(options: &TestTreeOptions) -> io::Result<TestTreeSummary> {
    if options.cleanup {
        if options.root.exists() {
            fs::remove_dir_all(&options.root)?;
        }

        return Ok(TestTreeSummary {
            root: options.root.clone(),
            files_created: 0,
            dirs_created: 0,
            cleaned: true,
        });
    }

    fs::create_dir_all(&options.root)?;

    let dirs = create_dirs(&options.root, options.dirs, options.max_depth.max(1))?;
    let mut targets = Vec::with_capacity(dirs.len() + 1);

    targets.push(options.root.clone());
    targets.extend(dirs.iter().cloned());

    for index in 0..options.files {
        let target_dir = &targets[index % targets.len()];
        let file_path = target_dir.join(format!("file-{index:06}.bin"));
        let mut file = fs::File::create(file_path)?;

        if options.file_size > 0 {
            write_bytes(&mut file, options.file_size)?;
        }
    }

    Ok(TestTreeSummary {
        root: options.root.clone(),
        files_created: options.files,
        dirs_created: dirs.len(),
        cleaned: false,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestTreeSummary {
    pub root: PathBuf,
    pub files_created: usize,
    pub dirs_created: usize,
    pub cleaned: bool,
}

fn create_dirs(root: &Path, count: usize, max_depth: usize) -> io::Result<Vec<PathBuf>> {
    let mut dirs = Vec::with_capacity(count);

    for index in 0..count {
        let depth = (index % max_depth) + 1;
        let mut path = root.to_path_buf();

        for level in 0..depth {
            path = path.join(format!("dir-{level:02}-{:06}", index / max_depth));
        }

        fs::create_dir_all(&path)?;
        dirs.push(path);
    }

    Ok(dirs)
}

fn write_bytes(file: &mut fs::File, size: usize) -> io::Result<()> {
    const CHUNK: [u8; 8192] = [0; 8192];
    let mut remaining = size;

    while remaining > 0 {
        let next = remaining.min(CHUNK.len());
        file.write_all(&CHUNK[..next])?;
        remaining -= next;
    }

    Ok(())
}
