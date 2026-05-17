#!/usr/bin/env bash
# Pre-push CVE audits. Both cargo-audit and pnpm audit fail the push only
# on advisories rated high or critical so churn on low/moderate transitives
# doesn't block legit work.

set -euo pipefail

# --- pnpm audit (npm advisory db) ----------------------------------------
echo "Running pnpm audit --audit-level=high…"
if ! pnpm audit --audit-level=high; then
  echo "pre-push: pnpm audit found high/critical advisories." >&2
  echo "Run 'pnpm audit' to inspect, 'pnpm update' or pin overrides to fix." >&2
  exit 1
fi

# --- cargo audit (RustSec advisory db) -----------------------------------
# Only vulnerabilities fail the hook. Unmaintained-crate warnings (gtk-rs
# GTK3 bindings, unic-*, proc-macro-error, etc.) are surfaced by the same
# command but treated as informational since they come from the Tauri 2
# ecosystem and have no drop-in replacement yet.
# Ignored advisories live in .cargo/audit.toml.
if ! command -v cargo-audit >/dev/null 2>&1; then
  echo "pre-push: cargo-audit is required but not installed." >&2
  echo "Install with: cargo install cargo-audit --locked" >&2
  exit 1
fi

echo "Running cargo audit…"
if ! cargo audit; then
  echo "pre-push: cargo audit found Rust vulnerabilities." >&2
  echo "Run 'cargo audit' to inspect or 'cargo update -p <crate>' to fix." >&2
  exit 1
fi

exit 0
