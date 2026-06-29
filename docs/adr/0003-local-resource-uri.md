# ADR 0003: Local Resource URI Model

## Status

Accepted

## Context

FileOctopus needs a stable resource identity that works across local files, archives, cloud providers, and future content-addressed data.

## Decision

Use `local://` URIs at the Rust domain and IPC boundary for MVP local resources.

Examples:

```text
local://C:/Users/Alice/Documents
local://D:/Projects/FileOctopus
local:///home/alice/Documents
local:///Users/alice/Documents
```

## Consequences

The UI may show friendly display paths, but persistent state and IPC use canonical URIs. Platform-native path conversion stays in Rust.

## Alternatives

Raw platform paths were rejected as the primary IPC model because they do not generalize to future provider schemes.
