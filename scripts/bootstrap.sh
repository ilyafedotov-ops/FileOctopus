#!/usr/bin/env bash
set -euo pipefail

if ! command -v rustc >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  . "$HOME/.cargo/env"
fi

command -v node >/dev/null
command -v pnpm >/dev/null
command -v cargo >/dev/null

pnpm install

printf '%s\n' 'Ready. Run pnpm dev to launch FileOctopus.'

