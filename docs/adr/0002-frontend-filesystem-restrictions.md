# ADR 0002: Frontend Filesystem Restrictions

## Status

Accepted

## Context

The frontend is less trusted than the Rust backend and must not receive broad filesystem capability.

## Decision

Do not enable unrestricted frontend filesystem access. File operations must pass through typed Rust APIs that validate URI, provider, capability, conflict, and safety requirements.

## Consequences

The UI cannot perform arbitrary local file access. Dangerous operations can become planned jobs with structured progress, cancellation, and auditability.

## Alternatives

Direct frontend filesystem plugins were rejected because they weaken safety and make future plugin security harder.
