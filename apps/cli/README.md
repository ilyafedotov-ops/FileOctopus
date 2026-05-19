# FileOctopus CLI

Headless command-line tools for local filesystem inspection.

## Usage

```bash
cargo run -p fileoctopus-cli -- list /path/to/dir
cargo run -p fileoctopus-cli -- list /path --json --hidden
cargo run -p fileoctopus-cli -- stat /path/to/file
cargo run -p fileoctopus-cli -- version
```

From the repo root you can also run `pnpm cli -- list .` when the workspace script is configured.
