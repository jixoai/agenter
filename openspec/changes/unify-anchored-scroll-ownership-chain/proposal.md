## Why

The previous anchored virtual list change established semantic scroll targets and closure-based transactions, but it still left multiple layers free to write the viewport independently. That gap means the platform law says "transaction-based scroll" while the implementation still behaves like competing local scroll managers, which is exactly why append/prepend flows can jitter, double-correct, or temporarily jump to stale rows.

## What Changes

- **BREAKING** tighten the anchored virtual list contract from "at most one active transaction" to "exactly one terminal scroll writer per viewport".
- **BREAKING** evolve `transact(...)` into an ownership-chain runtime where scroll behavior is composed through middleware-style programs instead of feature code, timeline code, and controller code each writing viewport position.
- Remove direct timeline-side scroll mutation from insert-motion and host render hooks; those layers may publish mutation facts and measurements, but they may not write the viewport directly.
- Re-express append/prepend preserve, latest pinning, older reveal, and insert-motion compensation as transaction-owned programs under one shared runtime.
- Migrate `Heartbeat`, `VirtualConversation`, and `@agenter/web-chat-view` off the remaining legacy scroll writers so all conversation surfaces use the same ownership chain.
- Add Storybook and unit regression coverage for double-writer races, including the observed append instability where the viewport can jump to an older row before settling on the newest row.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `anchored-virtual-list-scroll`: strengthen the scroll contract with single-writer ownership, transaction middleware chaining, and a ban on out-of-band viewport writes from host/timeline layers.
- `svelte-components-platform`: update the shared package contract so the exported anchored virtual list platform owns the full scroll runtime, not just targets and request helpers.
- `web-chat-view`: require room transcript mutation choreography to run entirely through the shared ownership-chain runtime rather than package-local reveal/preserve logic.
- `scrollview-surface`: clarify that shared scroll primitives must keep one effective scroll writer per viewport, even when virtualization, insert motion, or reconciliation are involved.

## Impact

- `openspec/specs/anchored-virtual-list-scroll/spec.md`
- `openspec/specs/svelte-components-platform/spec.md`
- `openspec/specs/web-chat-view/spec.md`
- `openspec/specs/scrollview-surface/spec.md`
- `packages/svelte-components/src/anchored-virtual-list-scroll-controller.ts`
- `packages/svelte-components/src/bottom-anchored-timeline.svelte`
- `packages/web-chat-view/src/web-chat-view-root.svelte`
- `packages/webui/src/lib/components/ai-elements/conversation/VirtualConversation.svelte`
- `packages/webui/src/lib/features/runtime/runtime-stage-heartbeat.svelte`
- Storybook DOM contracts and shared scroll-controller unit coverage
