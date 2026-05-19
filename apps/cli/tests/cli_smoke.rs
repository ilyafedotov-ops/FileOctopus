use std::process::Command;

fn cli_bin() -> Command {
    Command::new(env!("CARGO_BIN_EXE_fileoctopus-cli"))
}

#[test]
fn version_exits_successfully() {
    let output = cli_bin().arg("version").output().expect("spawn cli");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("fileoctopus-cli"));
}

#[test]
fn list_relative_path_works() {
    let output = cli_bin()
        .args(["list", "."])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("spawn cli");

    assert!(output.status.success(), "{:?}", output.stderr);
}
