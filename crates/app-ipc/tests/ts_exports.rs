use std::fs;
use std::path::Path;

#[test]
fn every_public_serializable_ipc_type_has_ts_export() {
    let src_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut missing = Vec::new();

    for entry in fs::read_dir(&src_dir).expect("read app-ipc src dir") {
        let path = entry.expect("read src entry").path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("rs") {
            continue;
        }

        let source = fs::read_to_string(&path).expect("read app-ipc source file");
        let lines: Vec<_> = source.lines().collect();

        for (index, line) in lines.iter().enumerate() {
            if !line.starts_with("#[derive(")
                || !line.contains("Serialize")
                || !line.contains("Deserialize")
            {
                continue;
            }

            let mut cursor = index + 1;
            while cursor < lines.len() && lines[cursor].trim_start().starts_with("#[") {
                cursor += 1;
            }

            let Some(type_line) = lines.get(cursor) else {
                continue;
            };
            let trimmed = type_line.trim_start();
            if !(trimmed.starts_with("pub struct ") || trimmed.starts_with("pub enum ")) {
                continue;
            }

            let attrs = lines[index + 1..cursor].join("\n");
            if !attrs.contains("feature = \"ts\"") || !attrs.contains("export_to") {
                missing.push(format!(
                    "{}:{} {}",
                    path.strip_prefix(&src_dir).unwrap().display(),
                    cursor + 1,
                    trimmed
                ));
            }
        }
    }

    assert!(
        missing.is_empty(),
        "public serializable IPC types missing ts-rs exports:\n{}",
        missing.join("\n")
    );
}
