## Why

The current shared scroll law still conflates two different problem spaces:

- standard static or virtual panels that only need one reusable scroll owner
- WebChat-like anchored virtual lists that must preserve a latest edge, survive prepend/append/resize churn, and arbitrate against wheel, touch, keyboard, and momentum input

That forces long transcript surfaces to keep rediscovering route-local scroll math, while the public package language still revolves around `ScrollView` and implementation details instead of future-facing platform terms such as scroll target, anchoring policy, and scrollend-driven settling.

## What Changes

- Introduce a new shared `anchored-virtual-list-scroll` capability that defines a semantic, transaction-based scroll coordinator for WebChat-like virtual long lists.
- **BREAKING** split the durable scroll law into two tiers: standard surfaces continue to use `ScrollView`, while anchored virtual long lists move to a dedicated scroll contract instead of stretching generic `ScrollView` semantics.
- Define a public target model around `edge`, `element`, and `position`, while keeping virtual-row materialization and anchor insertion inside the host adapter rather than in the public API.
- Define explicit user-input-aware arbitration for direct manipulation, wheel, keyboard, momentum, and reconcile traffic so one scroll writer owns the viewport at a time.
- Keep the first implementation inside `@agenter/svelte-components` rather than introducing a separate package or a custom scrollbar requirement; native browser scrollbars remain the baseline transport.
- Align package and consumer vocabulary with platform-facing terms such as `currentScrollTarget`, `eventualScrollPosition`, `anchoringPolicy`, `boundaryBehavior`, `containerScope`, and `awaitScrollEnd`.

## Capabilities

### New Capabilities
- `anchored-virtual-list-scroll`: semantic scroll coordination for WebChat-like anchored virtual lists, including targets, transactions, user-input arbitration, and virtualization-aware target materialization

### Modified Capabilities
- `scrollview-surface`: standard `ScrollView` law becomes explicitly distinct from the anchored virtual list scroll law
- `svelte-components-platform`: `@agenter/svelte-components` exports the new anchored virtual list scroll platform alongside existing structural primitives
- `web-chat-view`: shared room transcripts adopt the anchored virtual list scroll contract instead of extending generic `ScrollView` semantics

## Impact

- `openspec/specs/scrollview-surface/spec.md`
- `openspec/specs/svelte-components-platform/spec.md`
- `openspec/specs/web-chat-view/spec.md`
- `packages/svelte-components`
- `packages/web-chat-view`
- `packages/webui` surfaces that currently reuse `VirtualConversation` or other bottom/latest anchored transcript logic
- package boundary decision: first landing stays inside `@agenter/svelte-components`; no standalone scroll package is required for the initial implementation
- desktop + mobile browser scroll regression coverage, especially wheel/touch/keyboard/momentum conflict paths
