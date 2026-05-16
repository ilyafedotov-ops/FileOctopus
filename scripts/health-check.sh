#!/usr/bin/env bash
# FileOctopus health check — runs all checks, outputs summary
# Used by cron CI and manual verification
# Exit code: 0 = all pass, 1 = any failure

set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
RESULTS=""

run_check() {
  local name="$1"
  shift
  echo "⏳ $name..."
  if "$@" &>/tmp/fo-check-output.txt; then
    echo "   ✅ $name"
    RESULTS="$RESULTS\n✅ $name"
    ((PASS++))
  else
    echo "   ❌ $name (see /tmp/fo-check-output.txt)"
    RESULTS="$RESULTS\n❌ $name"
    ((FAIL++))
  fi
}

echo "═══════════════════════════════════════"
echo "  FileOctopus Health Check"
echo "  $(date -Iseconds)"
echo "═══════════════════════════════════════"
echo ""

# 1. Git status
if [ -z "$(git status --short)" ]; then
  echo "✅ Git: working tree clean"
  RESULTS="$RESULTS\n✅ Git: working tree clean"
  ((PASS++))
else
  echo "⚠️  Git: uncommitted changes:"
  git status --short | head -10
  RESULTS="$RESULTS\n⚠️ Git: uncommitted changes"
  ((PASS++))  # not a failure, just informational
fi
echo ""

# 2. TypeScript
run_check "TypeScript (tsc --noEmit)" \
  pnpm --filter @fileoctopus/frontend typecheck

# 3. Rust
run_check "Rust (cargo check)" \
  cargo check --workspace

# 4. Unit tests
run_check "Unit tests (vitest)" \
  pnpm --filter @fileoctopus/frontend test

# 5. Rust tests
run_check "Rust tests" \
  cargo test --workspace

# 6. ESLint
run_check "ESLint" \
  pnpm lint

# 7. E2E (only if Vite dev server is running or can be started)
if curl -sf http://localhost:1420 >/dev/null 2>&1; then
  run_check "E2E (Playwright)" \
    npx playwright test --reporter=list 2>/dev/null
else
  echo "⏭️  E2E: skipped (Vite dev server not running)"
  RESULTS="$RESULTS\n⏭️ E2E: skipped"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"
echo -e "$RESULTS"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
