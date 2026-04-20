## Why

`message-system` already owns durable room truth, but it does not yet provide a first-class query surface for authorized room history. Operators and AI runtimes need one shared message-specific query contract that supports exact matching, fielded search, and advanced read-only analysis without exposing raw room SQLite files or weakening room grant boundaries.

## What Changes

- Add a new `message-query` capability for room-local and cross-room authorized message queries.
- Introduce one unified request contract with `chatId`, `mode`, `query`, pagination, and shared result paging semantics.
- Support three message-specific query modes:
  - `match` for predictable substring and phrase matching
  - `query` for Lucene-like fielded search compiled from `@agenter/search-syntax`
  - `sql` for advanced read-only analysis against authorized message views
- Add a rebuildable SQLite-backed message index that projects searchable message fields without changing room durable truth ownership.
- Enforce authorization before every query so callers can only search rooms whose current room capabilities they hold.

## Capabilities

### New Capabilities

- `message-query`: Authorized message search and read-only analysis across one room, many rooms, or all currently authorized rooms.

### Modified Capabilities

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`
- Affected APIs: new authenticated `message.query(...)` surface plus message-system authorized query primitives
- Dependencies: reuse existing SQLite/Bun runtime and `@agenter/search-syntax`; no new DuckDB or external search engine dependency
