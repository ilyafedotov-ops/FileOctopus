#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash scripts/generate-ipc-types.sh
git diff --exit-code -- packages/ts-api/src/generated
