# ADR 0001: Tauri v2 Desktop Shell

## Status

Accepted

## Context

FileOctopus needs a cross-platform desktop shell with a small runtime, native packaging, and a Rust backend for privileged operations.

## Decision

Use Tauri v2 for the desktop application shell.

## Consequences

Rust owns privileged filesystem and platform behavior. The web frontend remains a UI layer and communicates through typed commands and events.

## Alternatives

Electron was rejected for MVP because it adds a larger runtime and does not reinforce Rust ownership of privileged operations.
