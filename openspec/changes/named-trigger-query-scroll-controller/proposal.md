## Why

The current anchored virtual list runtime already proved that semantic scroll transactions and single-writer arbitration are the right direction, but it still exposes the wrong public authoring model.

Feature code and Storybook harnesses can still reach for direct `request(...)`, `notifyMutation(...)`, or closure-local `transact(...)` calls, while scroll observations such as latest-edge state, user input, insert batches, and collection deltas are not modeled as named queryable facts.

That leaves three architectural gaps:

- the public law is still request-centric instead of trigger/query-centric
- observers and facts are not first-class reusable primitives
- consumers still need private wiring to turn DOM state into scroll decisions

## What Changes

- Introduce a new shared `named-trigger-query-scroll-controller` law on top of the anchored virtual list runtime.
- Split the scroll authoring model into four layers:
  - `ScrollController`
  - named `Trigger`
  - query tree
  - program-scoped `tx(...)`
- Add the trigger taxonomy required by WebChat-like virtual long lists:
  - base triggers for visibility, resize, action, user input, and optional scroll metrics
  - high-order triggers for edge, overflow, collection delta, materialization, and insert batch
- Keep `request(...)`, `notifyMutation(...)`, and raw `transact(...)` only as package-internal or compatibility shims; feature code and Storybook harnesses must migrate to named trigger programs.
- Migrate `AnchoredVirtualList`, `web-chat-view`, `VirtualConversation`, and `Heartbeat` onto the new controller model.
- Add Storybook acceptance that exposes registered trigger names, query subtrees, active tx ownership, and interruption behavior in one inspectable lab.

## Capabilities

### New Capabilities

- `named-trigger-query-scroll-controller`: a named-trigger, query-driven, transaction-owned scroll runtime for anchored virtual long lists

### Modified Capabilities

- `anchored-virtual-list-scroll`: the runtime keeps its tx/arbitration kernel, but its public authoring model shifts from manual request dispatch to named triggers plus program-owned tx
- `svelte-components-platform`: `@agenter/svelte-components` exports the named controller, trigger families, and query helpers
- `web-chat-view`: transcript scrolling adopts the named trigger/query runtime instead of route-local or harness-local imperative scroll control
- `workspace-runtime-shell`: Heartbeat transcript scrolling adopts the same runtime instead of local `timelineRef.request/transact` ownership

## Impact

- `openspec/specs/anchored-virtual-list-scroll/spec.md`
- `openspec/specs/svelte-components-platform/spec.md`
- `openspec/specs/web-chat-view/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
- `packages/svelte-components`
- `packages/web-chat-view`
- `packages/webui`
