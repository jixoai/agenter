## Context

Agenter uses attention as the kernel between external systems and LoopBus. The current `AttentionSystem` is multi-context, but it still models items as simple MSTC snapshots and keeps `AttentionEngine` alive as the primary contract. That blocks reply routing, lineage tracking, and output adapters.

## Decisions

### Native attention item
Each item is an immutable fact node:
- `id`
- `contextId`
- `parentIds: string[]`
- `meta`
- `scores: Record<string, number>`
- `title`
- `detail?: { kind: "replace" | "patch"; value: string; format?: string; baseItemId?: string }`
- `createdAt`
- `updatedAt`

`title` stays human-facing. `detail` carries internal context evolution.

### Native attention meta
`meta` becomes the routing contract. The minimal normalized fields are:
- `author`
- `source`
- `systemId?`
- `subjectId?`
- `channelId?`
- `replyTarget?`
- `tags?`
- `createdAt?`

Extra fields remain allowed.

### Context-local graph operations
`AttentionContext` owns:
- `append`
- `patch`
- `fork`
- `merge`
- `getActive({ minScore })`
- `queryByHash`
- `queryRelated({ hash, depth, minScore })`
- `queryByMeta`
- `subscribe`

`fork` is append-with-one-parent. `merge` is append-with-many-parents.

### Query threshold defaults to active items
All query APIs default `minScore = 1`. Callers only see resolved items when they explicitly ask for `minScore = 0`.

### Snapshot version 3
Persisted snapshots move to version 3. Store migration rules:
- V1 legacy numeric records -> one default context with native items
- V2 MSTC snapshot -> native items with `parentIds=[]`, `detail.kind=replace` when `context` exists

## Risks / Trade-offs

- This is a breaking API change for app-server and tools, but it removes the architecture split between native and facade paths.
- `merge` is represented as a new node with multiple parents, not a Git-style three-way merge algorithm.
