## Why

The current attention search is still a hand-written parser plus in-memory substring filtering. It cannot express richer search intent, does not offer real full-text retrieval, and keeps frontend syntax, backend filters, and AI tool contracts on separate mental models.

We need one query language and one searchable projection that improve attention retrieval without coupling the attention kernel to a storage-engine-specific query parser or turning the search index into a second source of truth.

## What Changes

- Add a new workspace package, `@agenter/search-syntax`, that parses a Lucene-like query subset into a stable AST with diagnostics and formatting helpers.
- Add a DuckDB-backed attention search index in `app-server` that projects persisted attention commits into a disposable FTS sidecar and uses it to accelerate text retrieval.
- Change runtime, client, WebUI, and AI `attention_query` calls from scattered structured fields to one `query` string contract.
- Keep attention durable truth in the existing attention snapshot/commit store; DuckDB search data is rebuildable projection state, not canonical session facts.
- Add parser, backend integration, and WebUI regression coverage for the new search contract.

## Capabilities

### New Capabilities

- `search-query-syntax`: Define the shared Lucene-like query language and AST contract used by WebUI and backend search adapters.
- `attention-search-index`: Define the DuckDB-backed full-text projection and query behavior for attention commits.
- `attention-devtools-search`: Define how the attention inspector accepts, validates, persists, and renders query-string-driven search.

### Modified Capabilities

- None.

## Impact

- `packages/search-syntax`
- `packages/app-server`
- `packages/webui`
- `packages/client-sdk`
- `packages/i18n-en`
- `packages/i18n-zh-Hans`
- `SPEC.md`
- New dependency: `@duckdb/node-api` in `app-server`
