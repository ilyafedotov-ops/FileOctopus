#!/usr/bin/env bash
# Pre-commit checks beyond lint-staged: large file guard + lockfile sync.
# Lives in scripts/ so it can be invoked from .git/hooks/pre-commit without
# embedding logic in package.json.

set -euo pipefail

MAX_BYTES="${FO_MAX_FILE_BYTES:-1048576}" # 1 MiB default

# --- Large file guard ------------------------------------------------------
staged="$(git diff --cached --name-only --diff-filter=ACM)"
violations=""

if [ -n "$staged" ]; then
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    if [ -f "$path" ]; then
      size="$(wc -c < "$path" | tr -d ' ')"
      if [ "$size" -gt "$MAX_BYTES" ]; then
        violations="$violations\n  $path ($size bytes)"
      fi
    fi
  done <<EOF
$staged
EOF
fi

if [ -n "$violations" ]; then
  printf 'pre-commit: staged files exceed %s bytes:%b\n' "$MAX_BYTES" "$violations" >&2
  printf 'Use git-lfs or split the file. Override with FO_MAX_FILE_BYTES if intentional.\n' >&2
  exit 1
fi

# --- Lockfile sync check ---------------------------------------------------
# If package.json is staged but pnpm-lock.yaml isn't (and a lockfile exists),
# the lockfile is almost certainly stale.
if echo "$staged" | grep -qx 'package.json'; then
  if ! echo "$staged" | grep -qx 'pnpm-lock.yaml'; then
    if [ -f pnpm-lock.yaml ]; then
      dep_change="$(
        git diff --cached -- package.json |
          grep -E '^[+-]  "(dependencies|devDependencies|peerDependencies|optionalDependencies|pnpm)": \{' ||
          true
      )"
      if [ -n "$dep_change" ]; then
        printf 'pre-commit: package.json is staged but pnpm-lock.yaml is not.\n' >&2
        printf 'Run "pnpm install" and stage the updated lockfile.\n' >&2
        exit 1
      fi
    fi
  fi
fi

exit 0
