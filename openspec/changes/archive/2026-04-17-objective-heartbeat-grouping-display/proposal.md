## Why

Heartbeat now has the right durable data model direction, but the operator-facing projection is still losing objective truth in three places:

- assistant thinking/text is flattened into one latest assistant snapshot instead of preserving chronological segments around tools
- grouped request-side facts are deduped by message id rather than payload truth, so compact can split one logical compact event across two cards
- running tool rows still look incomplete until completion even when durable parameters are already present

On the surface, that creates the exact failures the user called out: running invocations without visible parameters, compact rendered as a confusing pair of cards, top-of-stream loading overlapping the first card, and a Heartbeat story that does not stay anchored to the newest rows while the grouped stream mutates.

## What Changes

- Persist assistant response spans as objective ordered segments so `thinking -> tool -> thinking -> text` stays reconstructable in the Heartbeat ledger.
- Project grouped Heartbeat pages by payload-equivalent auxiliary truth instead of raw message id churn, and keep compact-specific prompt facts attached to the compact call.
- Render compact cycles as one special Heartbeat card that folds compact prompt facts in compact mode and reveals them in detailed mode.
- Treat running tool rows with durable parameters as `Running` immediately, keep those parameters visible before completion, and only upgrade the same row to `Completed` or `Error` once the result arrives.
- Keep top-of-stream older-page loading in a dedicated loading region and add surface-level regression coverage for latest-row stability while grouped history grows.

## Capabilities

### Modified Capabilities

- `runtime-ui-publication`: Heartbeat publication preserves assistant segment order, payload-truth grouping, and objective running invocation state
- `workspace-runtime-shell`: the Heartbeat surface renders compact as one special card, exposes running tool intent objectively, and keeps the top paging affordance attached to the stream

## Impact

- `packages/app-server/src/heartbeat-groups.ts`
- `packages/app-server/src/heartbeat-groups.test.ts`
- `packages/app-server/src/heartbeat-message-parts.ts`
- `packages/app-server/src/heartbeat-message-parts.test.ts`
- `packages/app-server/src/model-client.ts`
- `packages/app-server/test/heartbeat-invocation-ledger.integration.test.ts`
- `packages/app-server/test/session-runtime.cycle-streaming.test.ts`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-entry.svelte`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-group.svelte`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-part-content.svelte`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-parts.ts`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-parts.spec.ts`
- `packages/webui/src/lib/features/runtime/runtime-stage-heartbeat.svelte`
- `packages/webui/src/lib/features/runtime/runtime-stage-heartbeat.story-harness.svelte`
- `packages/webui/src/lib/features/runtime/runtime-stage-heartbeat.stories.ts`
- `packages/webui/test/storybook/runtime-stage-heartbeat.stories.test.ts`
- `openspec/specs/runtime-ui-publication/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
