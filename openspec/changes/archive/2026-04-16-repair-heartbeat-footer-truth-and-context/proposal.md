## Why

The current Heartbeat footer still mixes objective runtime facts with frontend inference. It cannot distinguish first-load from true empty history, it labels sessions as "Waiting for AI call" from model-call heuristics instead of scheduler truth, and it cannot trigger a manual compact cycle through a real runtime action. At the same time, the footer `Context` area only shows raw token counts, so operators cannot inspect max-context usage or even an estimated cost for the active provider.

We need to fix this now because Heartbeat is the operator's primary runtime inspection surface. As long as the footer and grouped Heartbeat slice do not obey durable runtime truth, the UI will keep showing misleading status and broken virtualization behavior at exactly the moment the operator needs reliable evidence.

## What Changes

- **BREAKING** Upgrade the Heartbeat grouped slice from a bare array into an explicit cached resource state so the UI can distinguish `loading`, `loaded-empty`, `refreshing`, and `error`.
- Add a formal runtime mutation for manual compaction so the Heartbeat footer can trigger `requestCompact("manual")` without injecting a fake `/compact` chat message.
- Make the Heartbeat footer consume scheduler truth for its status text and use grouped Heartbeat/resource state for empty/loading behavior.
- Replace the footer token badge with a richer context view that can show used tokens, max context, and an estimated price when provider metadata is available.
- Extend canonical provider settings metadata with optional max-context and tiered pricing bands, including uncached input, cached input, and output estimates.
- Repair Heartbeat virtual row measurement so group-card expand/collapse no longer leaves stale blank space at the bottom of the conversation surface.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-runtime-shell`: Heartbeat footer status, empty/loading behavior, manual compact affordance, and context details now follow durable runtime truth instead of frontend inference.
- `runtime-ui-publication`: the grouped Heartbeat slice now publishes explicit cached-resource load state and a runtime compact action path for UI consumers.
- `model-provider-standards`: canonical provider metadata now includes optional max-context and tiered pricing metadata for operator inspection and estimated cost display.

## Impact

- Affected code spans `packages/app-server`, `packages/client-sdk`, `packages/settings`, and `packages/webui`.
- New public runtime surface: a `runtime.requestCompact` mutation from WebUI/client-sdk into app-server runtime control.
- Existing settings schema and provider metadata inspection paths will expand to carry optional context-window and pricing-band metadata.
- Heartbeat stories/tests/specs must be updated to cover explicit loading/error states, scheduler-truth footer copy, manual compact action, and dynamic virtual-row measurement.
