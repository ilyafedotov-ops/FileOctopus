# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities through GitHub private vulnerability
reporting for this repository. Do not open a public issue for sensitive reports.

Include:

- affected commit or release,
- operating system,
- reproduction steps,
- expected impact,
- any relevant logs with secrets and personal paths redacted.

## Supported Versions

FileOctopus is pre-1.0. Security fixes target the current `main` branch until
versioned releases are published.

## Security Model

FileOctopus is a desktop file manager with intentionally powerful capabilities:
local file mutation, terminal execution, remote profiles, plugins, and archive
handling. The frontend is treated as untrusted for filesystem authority. Rust
validates filesystem resource URIs, command inputs, and operation plans before
privileged actions run.
