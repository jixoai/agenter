## Design

Terminal output remains the shared physical fact. Cursor state is a per-reader projection over that fact.

### Platform Law

- Terminal-core exposes output and caller-owned diff slicing primitives.
- Control-plane/runtime owns cursor identity, persistence, and consumption.
- Public read APIs keep two orthogonal switches:
  - `remark`: advances or preserves the actor cursor.
  - `recordActivity`: records or suppresses a terminal activity fact.

### Reader Identity

The reader actor is resolved at the boundary:

- superadmin or explicit actor reads use that actor id.
- terminal `accessToken` reads use the grant participant actor.
- trusted runtime bootstrap reads use the runtime actor.

No read path may fall back to a terminal-global cursor when an actor-backed access token exists.

### Compatibility

Runtime CLI compact encoding is positional, so `remark` is appended after the existing `recordActivity` field. Existing compact payloads such as `[terminalId, mode, false]` continue to mean `recordActivity:false`.
