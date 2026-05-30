# Sprint 3 Packaged App Smoke Test

## Environment

- OS:
- FileOctopus version:
- Bundle path:
- Tester:
- Date:

Use only a disposable directory such as `/tmp/fileoctopus-smoke`.

## Results

| Scenario                                                   | Result | Notes |
| ---------------------------------------------------------- | ------ | ----- |
| Launch packaged app                                        |        |       |
| Verify version/build metadata in Diagnostics               |        |       |
| Navigate to disposable local folder                        |        |       |
| Create folder                                              |        |       |
| Rename file                                                |        |       |
| Copy file                                                  |        |       |
| Move file                                                  |        |       |
| Move file to Trash or record unsupported platform behavior |        |       |
| Cancel a large copy                                        |        |       |
| Export diagnostics bundle                                  |        |       |
| Remove disposable fixture                                  |        |       |

## Setup

```bash
rm -rf /tmp/fileoctopus-smoke
mkdir -p /tmp/fileoctopus-smoke/source /tmp/fileoctopus-smoke/destination
printf "alpha" > /tmp/fileoctopus-smoke/source/alpha.txt
python3 - <<'PY'
from pathlib import Path
Path("/tmp/fileoctopus-smoke/source/large.bin").write_bytes(b"x" * 32 * 1024 * 1024)
PY
```

## Pass Criteria

- The app remains usable after every failed or cancelled operation.
- Destructive operations require confirmation.
- Operation history records completed, failed, cancelled, or interrupted states.
- Diagnostics export creates a `.zip` without user file contents.
