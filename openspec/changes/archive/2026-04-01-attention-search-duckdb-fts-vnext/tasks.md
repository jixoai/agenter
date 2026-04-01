## 1. Query syntax package

- [x] 1.1 Create `@agenter/search-syntax` with Lucene-like tokenization, AST parsing, formatting, and diagnostics
- [x] 1.2 Add parser unit tests for field clauses, boolean operators, phrases, comparisons, grouping, and invalid syntax

## 2. Backend attention search

- [x] 2.1 Add a DuckDB-backed attention search sidecar in `app-server` and project persisted attention commits into it
- [x] 2.2 Compile query strings into attention-domain controls plus a final AST evaluator
- [x] 2.3 Change runtime/app-kernel/AI query entrypoints to the single `query` string contract
- [x] 2.4 Add backend integration tests for active-only defaults, full-text retrieval, phrase search, structured filters, and `hash/depth` traversal

## 3. WebUI and client adaptation

- [x] 3.1 Update client-sdk and TRPC usage to send `query` strings instead of structured query bags
- [x] 3.2 Update the attention inspector to use shared syntax diagnostics and the new backend query API
- [x] 3.3 Add WebUI regression coverage for query normalization and invalid-query behavior

## 4. Durable spec and verification

- [x] 4.1 Update `SPEC.md` so search indexes are explicitly modeled as rebuildable projections over durable facts
- [x] 4.2 Run targeted tests plus a real backend verification flow if model credentials are available
