## Context

`avatar-seat-store` keeps a `DEFAULT_DOCUMENT` object and returns it directly when a seat file is missing or unreadable. Callers then mutate that object to inject a generated principal and seat credentials. Because the same object instance is reused, the next seat path that reads a missing file can see the previous path's in-memory principal and reuse it.

That violates the identity law:
- one seat file must produce one private key and one derived principal address,
- distinct seat paths must never silently share a principal,
- missing-file fallback must be pure and side-effect free.

At the application layer, `nickname` can remain a friendly alias or lookup key. But it is not the durable identity source, and this fix must stay anchored to seat-file isolation rather than alias semantics.

## Decision

Replace shared default-document reuse with a fresh-document factory. Every path that previously returned `DEFAULT_DOCUMENT` must now return a new object with new `messageSeats` and `terminalSeats` maps, so each seat-file path initializes its own private-key container.

## Scope

- `readAvatarSeatDocument()` on missing or invalid input
- `normalizeSeatDocument()` on invalid payload
- regression tests for first-time principal allocation across distinct seat-file paths

## Non-Goals

- No migration logic is needed.
- No changes to room grants, runtime prompts, or avatar catalog selection.
