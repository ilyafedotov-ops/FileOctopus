use std::env;
use std::path::PathBuf;
use std::process;

use test_support::{generate_test_tree, TestTreeOptions};

fn main() {
    match parse_args(env::args().skip(1).collect()) {
        Ok(options) => match generate_test_tree(&options) {
            Ok(summary) => {
                if summary.cleaned {
                    println!("cleaned {}", summary.root.display());
                } else {
                    println!(
                        "created {} files and {} directories under {}",
                        summary.files_created,
                        summary.dirs_created,
                        summary.root.display()
                    );
                }
            }
            Err(error) => {
                eprintln!("fileoctopus-test-tree failed: {error}");
                process::exit(1);
            }
        },
        Err(error) => {
            eprintln!("{error}");
            eprintln!(
                "usage: fileoctopus-test-tree --root <path> [--files n] [--dirs n] [--max-depth n] [--file-size n] [--cleanup]"
            );
            process::exit(2);
        }
    }
}

fn parse_args(args: Vec<String>) -> Result<TestTreeOptions, String> {
    let mut root = None;
    let mut files = 0;
    let mut dirs = 0;
    let mut max_depth = 1;
    let mut file_size = 0;
    let mut cleanup = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--root" => {
                index += 1;
                root = args.get(index).map(PathBuf::from);
            }
            "--files" => {
                index += 1;
                files = parse_usize(args.get(index), "--files")?;
            }
            "--dirs" => {
                index += 1;
                dirs = parse_usize(args.get(index), "--dirs")?;
            }
            "--max-depth" => {
                index += 1;
                max_depth = parse_usize(args.get(index), "--max-depth")?.max(1);
            }
            "--file-size" => {
                index += 1;
                file_size = parse_usize(args.get(index), "--file-size")?;
            }
            "--cleanup" => {
                cleanup = true;
            }
            value => {
                return Err(format!("unknown argument `{value}`"));
            }
        }

        index += 1;
    }

    let root = root.ok_or_else(|| "--root is required".to_string())?;
    let mut options = TestTreeOptions::new(root);

    options.files = files;
    options.dirs = dirs;
    options.max_depth = max_depth;
    options.file_size = file_size;
    options.cleanup = cleanup;

    Ok(options)
}

fn parse_usize(value: Option<&String>, name: &str) -> Result<usize, String> {
    value
        .ok_or_else(|| format!("{name} requires a value"))?
        .parse()
        .map_err(|_| format!("{name} must be a non-negative integer"))
}
