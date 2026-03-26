## Why

The codebase now has native `AttentionContext` and `AttentionItem` primitives, but the runtime still treats attention as one input source inside a LoopBus-centric cycle pipeline. That leaves the real kernel model split across old `LoopBus`/cycle/facts terminology, keeps `attention-reply` boundaries ambiguous, and still lets Chat leak internal attention activity instead of only showing messages that were explicitly dispatched to a channel.

## What Changes

- **BREAKING** make attention the primary runtime model for session orchestration; `LoopBus` remains an internal scheduler name rather than the user-facing architecture concept.
- **BREAKING** replace the current `collectLoopInputs() -> attention-system text fact -> model call` path with structured attention commits, refs, cycle frames, and egress records.
- Introduce typed attention cycle frames so each model pass, source read, and effect dispatch is anchored to explicit `attention-context` / `attention-item` references instead of flattened `inputs / facts / reply` dumps.
- Introduce typed attention egress routing for message-system, terminal-system, and future systems so only matched egress deliveries become user-visible side effects.
- Make Chat delivery explicit: only replies successfully dispatched through the message egress adapter into a `ChatChannel` may appear in Chat; internal attention items and unmatched replies stay in technical surfaces.
- Fold message/terminal focus and source invalidation into the same attention-first runtime contract so future systems can integrate by protocol instead of by session-runtime private wiring.
- Tighten unresolved-attention autonomy so `score > 0` keeps driving model/tool work until attention is actually patched or resolved, instead of letting plain-text/no-op rounds appear to finish the job.

## Capabilities

### New Capabilities
- `attention-runtime-kernel`: attention-first runtime orchestration with `attention-context` / `attention-item` as the primary execution model.
- `attention-cycle-frame`: cycle frames that persist time-sliced attention commits, model work, and side effects through stable references instead of flattened fact lists.
- `attention-egress-routing`: typed message/terminal/system egress adapters that route committed attention outcomes into external systems.

### Modified Capabilities
- `attention-source-plugins`: sources now commit structured attention drafts and refs into the attention kernel instead of producing flattened LoopBus text inputs.
- `attention-query-threshold`: active-query semantics apply to native multi-score attention items and relationship traversal instead of legacy single-score rows.
- `loopbus-plugin-pipeline`: plugin hooks become attention-first runtime hooks with explicit ingress, transform, scheduling, model-call, and egress phases.
- `workspace-chat-surface`: Chat only renders replies that were dispatched to a message channel, never raw internal attention updates.

## Impact

- Affected code: `packages/attention-system`, `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/loop-bus.ts`, `packages/app-server/src/loopbus-plugin-runtime.ts`, `packages/app-server/src/agenter-ai.ts`, `packages/client-sdk`, `packages/webui` Chat/runtime consumers.
- Affected data: session persistence, cycle records, runtime snapshots, message delivery records, and attention query payloads.
- Affected APIs/tools: attention append/query/update tools, runtime publication payloads, message/terminal focus contracts, and Chat delivery semantics.
- Supersedes the runtime direction from `attention-multi-context-mstc`, `attention-native-context-graph`, `loopbus-attention-io-pipeline`, and `session-runtime-attention-message-migration`.
