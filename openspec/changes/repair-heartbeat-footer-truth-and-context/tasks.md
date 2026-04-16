## 1. Runtime control and grouped Heartbeat publication

- [x] 1.1 Add a public runtime compact request path from WebUI/client-sdk through TRPC into app-server session runtime control.
- [x] 1.2 Upgrade grouped Heartbeat client state from a bare array to an explicit cached resource state with load/refresh/error facts.
- [x] 1.3 Split grouped Heartbeat hydration and refresh handling so first-load failure, warm refresh, and realtime invalidation preserve objective resource-state transitions.

## 2. Provider metadata and footer selectors

- [x] 2.1 Extend canonical provider settings/types/schema with optional `maxContextTokens` plus tiered pricing metadata.
- [x] 2.2 Update runtime Heartbeat config/settings helpers so provider metadata remains separate from next-call runtime knobs.
- [x] 2.3 Rebuild Heartbeat footer selectors to consume scheduler truth, grouped Heartbeat resource state, provider metadata, and latest model-call usage.

## 3. Heartbeat surface behavior and rendering

- [x] 3.1 Add the footer `Compact` action and wire it to the runtime compact mutation with correct disabled/pending behavior.
- [x] 3.2 Replace the existing footer token badge with the richer context presentation for usage, max-context progress, and estimated cost fallbacks.
- [x] 3.3 Make the Heartbeat stage distinguish first-load, empty, refreshing, and error states without clearing warm transcript data.
- [x] 3.4 Enable dynamic virtual-row measurement so Heartbeat expand/collapse and layout toggles no longer leave stale blank space.

## 4. Verification and spec sync

- [x] 4.1 Update unit and Storybook DOM coverage for grouped Heartbeat resource state, scheduler-truth footer copy, manual compact action, pricing estimation, and dynamic measurement.
- [x] 4.2 Update durable OpenSpec specs affected by the change and mark implementation tasks complete.
- [x] 4.3 Run targeted verification for typecheck and the affected runtime/client/webui test suites.
