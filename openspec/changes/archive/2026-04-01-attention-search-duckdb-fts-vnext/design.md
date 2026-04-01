## Context

The intent behind this change is architectural, not cosmetic:

- search syntax should be shared law, not a feature-local parser
- full-text retrieval should be an index/projection concern, not a kernel concern
- attention truth should remain durable facts, while search indexes stay disposable

The implementation reality also matters. `@duckdb/node-api` is asynchronous, while the existing `session.db` APIs are deeply synchronous and embedded in hot runtime paths. Replacing the entire session fact store inside this change would conflate two paradigm shifts: search architecture and durable fact-store migration. That would make the search change needlessly risky and blur the boundary between kernel facts and search projection.

This change therefore keeps session facts and attention snapshots as the durable truth, while introducing DuckDB only as the attention search projection.

## Goals / Non-Goals

**Goals**

- Establish one Lucene-like query language shared by WebUI and backend.
- Use DuckDB FTS for attention text retrieval instead of substring-only filtering.
- Keep attention graph semantics such as `hash/depth/minscore` valid.
- Preserve the law that indexes are projections over facts, not new authorities.
- Keep AI tool usage aligned with the same query-string contract used by users.

**Non-Goals**

- No full replacement of `session.db` in this change.
- No redesign of the attention commit model.
- No generalized multi-system search over messages, terminals, and tasks yet.
- No fuzzy-edit-distance ranking contract in v1.

## Decisions

### Add `@agenter/search-syntax` as the single query-language owner

The new package owns:

- tokenization
- parsing
- AST types
- formatting
- diagnostics

It does not own:

- attention-specific field semantics
- DuckDB SQL generation
- storage adapters

Why:

- The parser stays orthogonal and reusable.
- The backend remains free to compile the AST differently for attention, messages, or future systems.

### Use DuckDB only as a disposable attention search index

`app-server` will maintain a per-session `attention-search.duckdb` sidecar. The index is rebuilt from persisted attention snapshot data when needed and may be refreshed after attention commits.

Why:

- It gives us real FTS now without forcing a runtime-wide async storage rewrite.
- It preserves the law that `session.db` and attention snapshots are facts, while search indexes are derived.

Alternative considered:

- Replace `session.db` with DuckDB now. Rejected for this change because it would require a broad async persistence rewrite unrelated to the search behavior being fixed.

### Keep graph traversal semantics in the attention domain layer

`hash`, `score`, `depth`, and `minscore` remain attention-domain controls. The backend will keep using `AttentionSystem` for graph-aware base-set selection, then optionally use DuckDB FTS to narrow text candidates before final AST evaluation.

Why:

- DuckDB FTS is a text-retrieval primitive, not the owner of attention graph semantics.
- This preserves current attention behavior while upgrading the text-search layer.

### Use conservative FTS acceleration plus exact AST filtering

When a query is a safe positive conjunction with text seeds, DuckDB FTS is used to fetch candidate commit ids. Final filtering is still done against a compiled AST evaluator over attention documents.

When the query is too complex for safe FTS narrowing, the backend falls back to full in-memory evaluation over the base commit set.

Why:

- We get correct boolean/field behavior without pretending DuckDB is a Lucene parser.
- We avoid false negatives from over-aggressive FTS pruning.

### Move public query contracts to one `query` string

The following public contracts change from field bags to a single query string:

- TRPC `runtime.attentionQuery`
- client-sdk `queryAttention`
- WebUI attention inspector query callback
- AI `attention_query` tool input

Why:

- Users and AI should share the same search language.
- The old split contract guaranteed drift between UI, backend, and tool usage.

## Risks / Trade-offs

- Complex queries can still fall back to in-memory filtering. Mitigation: keep the evaluator correct first, optimize later.
- DuckDB FTS extension loading may fail in some environments. Mitigation: surface the failure clearly and keep the non-FTS evaluator path working.
- Query syntax can grow beyond current domain support. Mitigation: keep parser generic and domain semantics explicit, with diagnostics for unsupported attention-only controls in invalid positions.
