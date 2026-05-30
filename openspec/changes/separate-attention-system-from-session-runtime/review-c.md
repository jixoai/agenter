## Review C

### Scope

Review the first migrated source path after implementation and focused regression:

- source path: `message follow-up -> AttentionControlPlane -> durable attention truth`
- objective: verify that runtime recovery and inspection surfaces do not quietly reintroduce the old story that attention is runtime-owned glue

### Verified behavior

The core migrated behavior is correct:

- a due follow-up now persists attention truth while runtime is offline
- runtime restart wakes from durable attention state instead of replaying the source event
- the first migrated path no longer depends on `SessionRuntime` being alive to write reminder attention

Focused regression evidence:

- `bun test packages/attention-system/test/attention-system.test.ts packages/message-system/test/message-system.test.ts packages/app-server/test/session-runtime.attention-system.test.ts --timeout 120000`
- result at review time: `151 pass / 0 fail`

### Residue found

The migrated path is correct, but the surrounding inspection/story surfaces still leak legacy ownership language.

#### Runtime / backend residue

- `packages/app-server/src/session-runtime.ts`
  - still emits `attentionDeliveryUpdated`
  - still exposes `inspectAttentionDeliveryState()` and `attentionDeliveryTimeline`
  - still materializes a runtime `SessionRuntimeAttentionDeliveryState`

This means the backend inspection surface still presents a cross-system delivery story under an `attention*` namespace.

#### Studio / frontend residue

- `extensions/studio/src/lib/features/runtime/runtime-stage-heartbeat.svelte`
  - renders a section literally titled `Attention delivery`
- `extensions/studio/src/lib/features/runtime/runtime-cycle-inspector-state.ts`
  - still models `deliveryDispatches`, `deliveryReceipts`, and `deliveryEffects` as part of cycle detail
- `extensions/studio/src/lib/features/runtime/runtime-stage-attention.svelte`
  - still derives list/detail state from `runtime.attentionDelivery`
- related stories/specs still encode the same old shape:
  - `runtime-stage-heartbeat.stories.ts`
  - `runtime-cycle-inspector-state.spec.ts`
  - `runtime-shell-state.spec.ts`

### Alignment verdict

The first migrated source path itself is aligned.

What is not aligned yet is the surrounding diagnostic and UI narrative:

- attention truth is now durable and independently owned
- but runtime/studio still expose some legacy surfaces as if attention also owns delivery attempts, receipts, and effects

That residue does **not** invalidate the migration, but it **does** block expanding this pattern to more source-owned ingress paths until the ownership story is cleaned up.

### Decision after Review C

1. Accept the first migrated source path as behaviorally correct.
2. Do not migrate additional source-owned ingress paths yet.
3. Continue with:
   - `5.2` remove runtime-private external ingress residue
   - `5.3` clean runtime/studio inspection surfaces so delivery/effect diagnostics stop masquerading as attention-owned state
