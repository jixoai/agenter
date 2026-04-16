## Why

The current Heartbeat surface still breaks objective runtime inspection in several places: footer context is rendered through a custom block instead of the shared AI-elements contract, running durations only refresh when new data arrives, top-of-stream pagination overlaps transcript content, and the Heartbeat config panel can write invalid JSON back into avatar settings. These gaps make the runtime surface diverge from durable truth exactly where operators need it most: while a call is still running.

## What Changes

- Tighten the Heartbeat surface contract so the footer context details use the shared AI-elements `Context` composition rather than a local placeholder block.
- Require running Heartbeat group headers to maintain a live elapsed-duration clock even when no new Heartbeat event arrives.
- Tighten grouped Heartbeat publication so running tool-invocation parameter hydration appears on the existing running row as soon as durable invocation input is known, without waiting for completion.
- Tighten top-of-stream Heartbeat pagination so the affordance occupies its own in-flow region above the first group row and shows a loading treatment while older groups are being fetched.
- Require Heartbeat config saves to serialize valid JSON back into the editable avatar settings layer and persist runtime knobs under top-level `ai.*` fields, including `ai.thinking`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-runtime-shell`: refine the Heartbeat footer/statusbar and transcript interaction contract to require the shared AI-elements context presentation, live running durations, and non-overlapping top-of-stream pagination behavior.
- `runtime-ui-publication`: require grouped Heartbeat publication to republish running invocation argument hydration immediately and keep the same grouped visual row while parameters become available.
- `settings-cascade-provenance`: require editable settings layers to round-trip valid JSON when runtime settings are saved from Heartbeat and preserve runtime model knobs under top-level `ai.*` fields.

## Impact

- WebUI Heartbeat stage, footer statusbar, grouped conversation projection, and Heartbeat config panel.
- Runtime grouped Heartbeat publication and selector invalidation behavior.
- Avatar settings layer editing and JSON serialization in the runtime settings workflow.
