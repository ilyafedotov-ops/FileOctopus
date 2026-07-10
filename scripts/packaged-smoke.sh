#!/usr/bin/env bash
# Launch packaged FileOctopus against RC smoke fixtures (Linux).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')).version")"
APPIMAGE="$ROOT/target/release/bundle/appimage/FileOctopus_${VERSION}_amd64.AppImage"
DEB_BIN="$ROOT/target/release/fileoctopus-desktop"

if [ ! -d /tmp/fileoctopus-smoke/source ]; then
  echo "Run scripts/rc-qa-automated.sh first to create /tmp/fileoctopus-smoke"
  exit 1
fi

echo "Smoke fixture: file:///tmp/fileoctopus-smoke/source"
echo "Navigate in app to: local:///tmp/fileoctopus-smoke/source"
echo ""

if [ -x "$APPIMAGE" ]; then
  exec "$APPIMAGE"
elif [ -x "$DEB_BIN" ]; then
  exec "$DEB_BIN"
else
  echo "No packaged binary found. Run: pnpm tauri:build"
  exit 1
fi
