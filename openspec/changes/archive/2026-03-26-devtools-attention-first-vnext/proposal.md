## Why

The frontend still presents the runtime through old `LoopBus`, `inputs`, `facts`, and `reply` concepts, so the new attention architecture is not actually visible or explainable in the app. As a result, Devtools and Cycle detail still reflect the legacy runtime story instead of the intended attention-first model with contexts, items, cycle frames, model calls, and trace.

## What Changes

- **BREAKING** redesign Devtools information architecture around attention as the primary concept: contexts, cycles, model calls, trace, terminals, and tasks.
- **BREAKING** remove `LoopBus` as a primary user-facing panel name; keep it only as an internal implementation term where needed.
- Replace cycle detail sections such as `inputs / facts / reply / technical records` with attention-native detail anchored to context/item refs, merged tool traces, model work, and egress outcomes.
- Introduce dedicated attention context and attention item inspection flows so users can follow item evolution, score reduction, forks, merges, and cross-context routing.
- Keep Chat conversation-first: technical attention activity remains in Devtools unless it was actually dispatched into a chat channel.
- Align frontend publication, tab ownership, loading states, and heavy-list subscriptions with the new attention-first data model.

## Capabilities

### New Capabilities
- `attention-devtools-surface`: attention-first Devtools IA covering contexts, cycle frames, model calls, trace, terminals, and tasks.
- `attention-context-inspector`: inspect context ownership, active items, links, score vectors, and item evolution history.

### Modified Capabilities
- `workspace-devtools-surface`: Devtools becomes attention-first and stops using LoopBus/facts/reply as its primary narrative.
- `cycles-devtools-timeline`: cycle rows and detail link to attention refs, merged tool traces, model-call records, and egress outcomes.
- `runtime-ui-publication`: UI consumers subscribe to attention-native slices instead of broad LoopBus-centric projections.
- `chat-surface-presentation`: Chat remains conversation-first and exposes technical attention state only through explicit expert affordances.

## Impact

- Affected code: `packages/webui/src/features/process`, `packages/webui/src/features/loopbus`, `packages/webui/src/features/chat`, `packages/webui/src/features/terminal`, `packages/client-sdk` runtime selectors.
- Affected UX: Devtools routing, panel naming, cycle detail structure, attention inspection, and Chat-to-Devtools boundaries.
- Verification: Storybook DOM contracts for compact/expanded Devtools panels plus desktop/mobile browser walkthroughs.
- Supersedes `devtools-multi-context-attention-facts` as the authoritative frontend direction.
