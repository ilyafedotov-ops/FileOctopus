#!/usr/bin/env bash
# FileOctopus E2E test runner
# Usage:
#   ./scripts/e2e.sh          — run against Vite dev server (default)
#   FO_E2E_MODE=tauri ./scripts/e2e.sh  — run against running Tauri app
#   ./scripts/e2e.sh --ui     — open Playwright interactive UI
#   ./scripts/e2e.sh --headed — run with browser visible

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔍 FileOctopus E2E Tests"
echo "   Mode: ${FO_E2E_MODE:-vite}"
echo "   Dir:  $(pwd)"

# Check Playwright is installed
if ! npx playwright --version &>/dev/null; then
  echo "❌ Playwright not found. Run: pnpm install && npx playwright install chromium"
  exit 1
fi

# Check Vite dev server or Tauri app is reachable
if [ "${FO_E2E_MODE:-vite}" = "vite" ]; then
  if ! curl -sf http://localhost:1420 >/dev/null 2>&1; then
    echo "⚠️  Vite dev server not running on :1420 — Playwright will start it automatically"
  else
    echo "✅ Vite dev server reachable on :1420"
  fi
else
  echo "📡 Tauri mode — ensure app is running (Xvfb + pnpm tauri dev)"
fi

echo ""
echo "🚀 Running E2E tests..."
echo ""

npx playwright test "$@"

echo ""
echo "✅ E2E tests complete"
