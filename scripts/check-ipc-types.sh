#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SNAPSHOT="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT"' EXIT
cp -R packages/ts-api/src/generated "$SNAPSHOT/generated"

bash scripts/generate-ipc-types.sh
diff -ru "$SNAPSHOT/generated" packages/ts-api/src/generated
pnpm --filter @fileoctopus/ts-api exec vitest run tests/catalogs.test.ts
