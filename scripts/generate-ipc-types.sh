#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
trap 'rm -rf crates/jobs/bindings' EXIT

rm -rf crates/app-ipc/bindings crates/jobs/bindings
cargo test -p app-ipc --features ts
cargo test -p jobs --features ts

OUT_DIR="packages/ts-api/src/generated"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -R crates/app-ipc/bindings/git \
  crates/app-ipc/bindings/ipc \
  crates/app-ipc/bindings/jobs \
  crates/app-ipc/bindings/vfs \
  "$OUT_DIR/"
cp crates/jobs/bindings/jobs/*.ts "$OUT_DIR/jobs/"

for dir in "$OUT_DIR"/git "$OUT_DIR"/ipc "$OUT_DIR"/jobs "$OUT_DIR"/vfs; do
  find "$dir" -maxdepth 1 -type f -name '*.ts' ! -name 'index.ts' -exec basename {} .ts \; \
    | LC_ALL=C sort \
    | awk '{ printf "export type { %s } from \"./%s\";\n", $0, $0 }' \
    > "$dir/index.ts"
done

cat > "$OUT_DIR/index.ts" <<'EOF'
export * from "./git";
export * from "./ipc";
export * from "./jobs";
export * from "./vfs";
EOF

pnpm exec prettier --write "$OUT_DIR/**/*.ts"
