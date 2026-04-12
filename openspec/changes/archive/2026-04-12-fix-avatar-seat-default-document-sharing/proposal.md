## Why

Multi-avatar validation exposed a backend identity bug: when two seat documents are created for the first time, they can inherit the same in-memory default document and therefore the same generated private key / principal address. That collapses distinct identity roots into one actor, which breaks room authorship, grants, and any collaboration scenario that relies on actor identity.

This is not a test-only issue. It corrupts the platform law that the private key is the identity source, the derived address is the public identity id, and each seat file path must isolate its own identity root. `nickname` is only an application-layer alias/lookup surface.

## What Changes

- Fix avatar seat document initialization so each missing or invalid seat document starts from a fresh object instead of a shared singleton.
- Add regression tests proving two fresh seat files in one workspace receive different principals and persist them independently.

## Capabilities

### Modified Capabilities
- `avatar-seat-identity-allocation`: seat initialization now guarantees per-seat-file private-key/address isolation on first creation.

## Impact

- Affected systems: `packages/app-server` avatar seat store and session/avatar identity allocation.
- Affected APIs: none.
- Affected operations: all new seat creation in workspace or global avatar roots now produces isolated principals.
