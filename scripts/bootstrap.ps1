$ErrorActionPreference = "Stop"

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
  Write-Error "Install Rust from https://rustup.rs, then rerun this script."
}

Get-Command node | Out-Null
Get-Command pnpm | Out-Null
Get-Command cargo | Out-Null

pnpm install

Write-Output "Ready. Run pnpm dev to launch FileOctopus."

