#!/usr/bin/env bash
# RC-4 / RC-3 automated evidence runner (no packaged-app UI required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
DATE_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REPORT="$ROOT/docs/qa/rc-automated-evidence.md"

echo "FileOctopus RC automated QA"
echo "  commit: $COMMIT"
echo "  utc:    $DATE_UTC"

mkdir -p ./tmp
mkdir -p "$(dirname "$REPORT")"

echo ""
echo "== Sprint 3 smoke fixture =="
rm -rf /tmp/fileoctopus-smoke
mkdir -p /tmp/fileoctopus-smoke/source /tmp/fileoctopus-smoke/destination
printf "alpha" > /tmp/fileoctopus-smoke/source/alpha.txt
python3 - <<'PY'
from pathlib import Path
Path("/tmp/fileoctopus-smoke/source/large.bin").write_bytes(b"x" * 32 * 1024 * 1024)
PY
echo "  fixture: /tmp/fileoctopus-smoke (32 MiB large.bin)"

echo ""
echo "== Sprint 4 baseline fixture =="
rm -rf /tmp/fileoctopus-sprint-4
mkdir -p /tmp/fileoctopus-sprint-4/source/folder/nested /tmp/fileoctopus-sprint-4/destination
printf "alpha" > /tmp/fileoctopus-sprint-4/source/alpha.txt
printf "hidden" > /tmp/fileoctopus-sprint-4/source/.hidden-alpha
printf "needle" > /tmp/fileoctopus-sprint-4/source/folder/nested/needle.txt
echo "  fixture: /tmp/fileoctopus-sprint-4"

echo ""
echo "== 10k directory tree (skip if tmp/10k exists) =="
if [ ! -d "./tmp/10k" ]; then
  cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/10k --files 10000 --dirs 0
else
  echo "  reusing existing ./tmp/10k"
fi

echo ""
echo "== Backend RC + diagnostics bundle test =="
pnpm test:backend:rc

echo ""
echo "== Frontend RC =="
pnpm test:frontend:rc

echo ""
echo "== Playwright E2E (Vite preview shell) =="
pnpm test:e2e:vite

cat >"$REPORT" <<EOF
# RC Automated Evidence

- **Date (UTC):** $DATE_UTC
- **Commit:** $COMMIT
- **Runner:** \`scripts/rc-qa-automated.sh\`

## Automated checks (this run)

| Check | Command / test | Result |
| ----- | -------------- | ------ |
| RC validate | \`pnpm test:backend:rc\` + \`pnpm test:frontend:rc\` | see terminal |
| Diagnostics zip | \`diagnostics_bundle_contains_expected_files\` (in backend RC) | included |
| 10k list streaming | \`local_provider::list_streams_without_collecting_all_entries_first\` | included in \`cargo test -p fs-core\` |
| 100k UI virtualization | \`appShell.test.tsx\` 100k batch | included in frontend RC |
| Playwright E2E | \`FO_E2E_WEB_SERVER=vite npx playwright test\` | see terminal |
| Smoke fixture | \`/tmp/fileoctopus-smoke\` | prepared |
| Sprint 4 fixture | \`/tmp/fileoctopus-sprint-4\` | prepared |
| 10k tree | \`./tmp/10k\` | prepared or reused |
| Locked-file QA | platform-specific manual evidence item | recorded below |

## Manual follow-up (human on target hardware)

- [ ] \`docs/qa/sprint-3-smoke-test.md\` against packaged \`.deb\` / AppImage
- [ ] \`docs/qa/sprint-4-baseline-qa.md\` full checklist
- [ ] \`docs/testing/large-directory-performance.md\` scroll recording for \`tmp/10k\` and \`tmp/100k\`
- [ ] Locked-file behavior on target OS: record whether rename, delete, and overwrite of an open file succeed, fail, or require retry
- [ ] Export diagnostics bundle from Help menu and inspect zip contents

## Navigation URIs (preview / dev)

- 10k: \`local://$ROOT/tmp/10k\`
- 100k: generate with \`fileoctopus-test-tree --files 100000\` then navigate to \`local://$ROOT/tmp/100k\`
EOF

echo ""
echo "Report written: $REPORT"
