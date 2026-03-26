## Context

The runtime currently treats `attention-item` as both the mutable work state and the immutable history record. That forces downstream code to infer the "current truth" by scanning item revisions, and it tempts plugins to attach side effects directly onto items.

## Goals / Non-Goals

**Goals**
- Make `attention-context` the mutable state object.
- Make `attention-commit` the immutable history object.
- Reduce the AI tool surface to a single `attention_commit` entry point.
- Keep context scheduling driven by unresolved scores on the context itself.

**Non-Goals**
- Add a large catalog of change encodings in v1.
- Preserve backward-compatible item/patch semantics.
- Rebuild chat or terminal UX in this change.

## Decisions

### Context owns current state
Each context owns:
- `contextId`
- `owner`
- `content`
- `contentFormat`
- `scoreMap`
- `headCommitId`
- timestamps

Why: active debt and current content are properties of the context, not emergent properties of the last item scan.

### Commit is immutable and minimal
Each commit owns:
- `commitId`
- `contextId`
- `parentCommitIds`
- `meta`
- `scores`
- `summary`
- `change`
- `createdAt`

Why: commits should be cheap for the AI to produce and cheap for the runtime to reason about.

### Single tool: `attention_commit`
The AI uses one tool with this shape:

```ts
attention_commit({
  contextId,
  parentCommitIds?,
  meta?,
  scores,
  summary,
  change,
})
```

Why: the AI should think in commits, not in append-vs-patch mechanics.

### Minimal change vocabulary
V1 supports only:
- `{ type: "update", value: string, format? }`
- `{ type: "diff", value: string, format? }`
- `{ type: "clean" }`

Default semantics:
- `update` fully replaces `context.content`
- `diff` applies an incremental patch to the current content
- `clean` clears `context.content`

Why: wider syntax support increases token cost before it proves value.

### Context-first loop input
LoopBus attention input is the set of active contexts. Each context payload contains the current head state and a bounded recent commit history relevant to unresolved work.

Why: unresolved work belongs to the context. Items/commits remain history and explanation.

## Risks / Trade-offs

- Context snapshots become larger than single-item payloads -> mitigate by bounding recent commit history and keeping `change` compact.
- Diff application must be deterministic -> mitigate with tests and explicit failure handling.
- Breaking rename (`item` -> `commit`) touches many frontend and runtime consumers -> mitigate by landing the kernel first, then the bridge/UI changes.

## Migration Plan

1. Replace attention-system primitives with context state + commit log.
2. Update runtime scheduling, persistence, and model tools to use `attention_commit`.
3. Update client types and runtime snapshots to publish contexts and commits.
4. Remove legacy append/patch tool exposure.
