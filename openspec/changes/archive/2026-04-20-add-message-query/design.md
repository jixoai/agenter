## Context

`message-system` currently owns durable room truth through one control-plane catalog plus one SQLite message database per room. The system already exposes room snapshots, paging, grants, and transport updates, but it does not expose a first-class query surface for room history. The requested behavior is message-specific rather than platform-generic: it must support exact match, fielded search, and advanced read-only SQL while continuing to respect the existing room capability model (`actor -> grant -> access token -> room visibility`).

The repository is Bun-first today. Core packages already depend on `bun:sqlite`, `bun:test`, and `Bun.*` runtime APIs, so adding a second SQLite runtime just for message queries would increase complexity without improving the current deployment contract.

## Goals / Non-Goals

**Goals:**

- Provide one message-specific query contract that AI tooling, CLI, and authenticated browser surfaces can all reuse.
- Support `match`, `query`, and `sql` modes without exposing raw room SQLite files to callers.
- Keep room durable truth in `message-system`; query indexes remain rebuildable projection state.
- Enforce room authorization before every query, including `chatId: "*"` cross-room searches.
- Reuse the existing shared query parser where it already fits the problem.

**Non-Goals:**

- Introduce a generic search abstraction for other systems.
- Replace room paging or transport snapshot APIs with the query API.
- Introduce semantic vector search in this change.
- Add a Node/Deno compatibility layer or replace Bun runtime dependencies.

## Decisions

### 1. Use a message-specific SQLite sidecar index instead of DuckDB

The query engine will use a dedicated SQLite sidecar database (`message-query.sqlite`) plus FTS5 virtual tables. This keeps the implementation aligned with the repository's existing Bun-first runtime and avoids a second query engine dependency.

Alternatives considered:

- DuckDB sidecar: rejected for v1 because it adds another engine, another index lifecycle, and a second query dialect without solving the core authorization or contract problem.
- Meilisearch/external engine: rejected because the requested behavior fits local SQLite deployment and does not require a new daemon.

### 2. Keep query projection separate from room durable truth

Room truth stays in the existing per-room SQLite databases. The new sidecar only stores searchable projections (`message_doc`, FTS rows, metadata) that can be rebuilt from durable room history. Query failures must not roll back truth writes.

Alternatives considered:

- Add FTS tables into every room database and query them directly: acceptable for room-local lookup, but weak for `chatId: "*"` cross-room search and awkward for stable read-only SQL over many rooms.
- Expose raw room databases to callers: rejected because it leaks physical storage layout and makes authorization brittle.

### 3. Expose one unified `message query` contract with three modes

The public request shape will use:

- `chatId: string | string[] | "*"`
- `mode: "match" | "query" | "sql"`
- `query: string`
- optional pagination fields

`match` is predictable substring/phrase matching. `query` reuses `@agenter/search-syntax` and compiles field filters plus FTS terms into SQLite queries. `sql` allows advanced analysis, but only through a guarded read-only subset.

Alternatives considered:

- Many endpoint-specific search APIs: rejected because AI callers would need to learn too many message-specific variants.
- SQL-only: rejected because user-facing search and simple AI retrieval need safer default semantics than arbitrary SQL.

### 4. Authorization is resolved before search scope, never after

Every query first resolves the effective room set:

- single room via `{ chatId, accessToken }`
- many rooms via explicit authorized scopes
- `chatId: "*"` via the caller's current room grants

Only that room set is loaded into the message-query scope. SQL runs against read-only views built from this pre-authorized scope; it never sees the full global catalog.

Alternatives considered:

- Search all rooms then filter result rows afterward: rejected because it would make authorization a best-effort presentation concern instead of a storage/query boundary.

### 5. Keep `message query` message-specific and non-generic

The new modules stay inside `packages/message-system` and only model message fields. Shared code is limited to parsing and small helper logic. No generic `SearchSystem` naming or abstraction is introduced.

Alternatives considered:

- Introduce a repository-wide generic search package: rejected because other systems have different truth models (`sqlite`, `git+files`, custom state) and forcing one abstraction would add accidental complexity.

## Risks / Trade-offs

- [Risk] Sidecar index can drift from room truth after partial failures. → Mitigation: track dirty state, reconcile on startup, and reconcile before query when needed.
- [Risk] FTS5 availability could differ across unexpected runtime environments. → Mitigation: detect FTS support during index initialization and degrade `query` to field filters plus substring match with explicit capability reporting.
- [Risk] Read-only SQL can still become too permissive if the guard is loose. → Mitigation: only allow single `SELECT`/`WITH ... SELECT`, reject mutating or attachment-related commands, and run SQL only on pre-authorized views.
- [Risk] Cross-room indexing duplicates searchable message text. → Mitigation: keep only message-query projection fields, not full room snapshots, and rebuild instead of storing secondary truth.
- [Risk] Result semantics between `match` and `query` may diverge in ways that confuse callers. → Mitigation: document deterministic ordering rules per mode and return the selected `mode` in every response.

## Migration Plan

1. Add message-query sidecar schema and reconciliation support behind message-system internals.
2. Index existing durable room history into the sidecar during initialization or first query.
3. Add message-system authorized query methods and app-server authenticated wrapper APIs.
4. Expose the same contract through runtime-local `message query` CLI so AI can reach it via `root_workspace_bash` without introducing a new direct model tool.
5. Add client-facing contract types after backend behavior is stable.
6. Rollback strategy: disable query entrypoints and remove the sidecar file; room durable truth remains untouched.

## Runtime Shell Exposure

- `message query` must be one more descriptor-backed runtime CLI subcommand under the existing `message` namespace.
- Runtime shell exposure cannot fork the backend contract into a second bespoke query API; it should reuse the same `chatId + mode + query + paging` shape, with runtime auth resolved from the current avatar actor.
- AI validation must happen through the real runtime shell surface (`root_workspace_bash -> message query`), not by calling app-kernel or tRPC helpers directly inside tests.

## Open Questions

- Whether the first UI integration should expose all three modes or keep `sql` CLI/AI-only while the browser uses `match/query`.
- Whether `mode=match` should preserve literal case-sensitive matching or normalize case by default for v1.
