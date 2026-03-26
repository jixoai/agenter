## Why

The current attention refactor still stops at an MSTC-compatible compatibility layer. Agenter now needs attention as a native graph kernel: items evolve, fork, merge, route, and query across contexts without going through the old numeric-record facade.

## What Changes

- Replace the public attention API with native `AttentionSystem` / `AttentionContext` / `AttentionItem` operations.
- Upgrade attention items from flat MSTC payloads into graph-native items with `parentIds`, normalized routing metadata, and structured detail payloads.
- Make query semantics active-by-default (`minScore = 1`) and relationship traversal hash-first.
- Persist the new snapshot format directly, including migration from legacy V1 and current V2 snapshots.

## Capabilities

### New Capabilities
- `attention-native-context-graph`: Native multi-context attention graph with append/patch/fork/merge/query semantics.

### Modified Capabilities
- `attention-query-threshold`: Zero-score items are excluded unless explicitly requested.
- `attention-source-plugins`: Source adapters now target native attention contexts/items instead of V1 records.

## Impact

- Affected code: `packages/attention-system`, `packages/app-server`, `packages/client-sdk`, WebUI facts consumers.
- Breaking change: remove the old `AttentionEngine` facade and V1 numeric-record API from the main runtime path.
