## Why

Real browser verification exposed a durable mismatch in the Heartbeat observability path: the runtime persisted room ingress facts into `session.db`, but the `Heartbeat` tab still rendered `No Heartbeat rows yet`. This now blocks objective operator review because Heartbeat no longer reflects the full runtime story at the moment a room message arrives.

## What Changes

- Repair the runtime Heartbeat inspection feed so it includes every persisted ingress fact the operator needs to understand the loop, including room/user ingress that currently lands in legacy `heartbeat` scope.
- Ensure live Heartbeat publication updates the browser when those ingress facts are recorded, instead of only updating after newer `heartbeat_part` rows appear.
- Keep the unified Heartbeat stream chronologically ordered across legacy heartbeat rows, structured heartbeat-part rows, and request-aux rows.
- Add regression coverage for the router/store/browser path where a room message is durably recorded before or without a later assistant response.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-runtime-shell`: Heartbeat must show the full persisted runtime message-parts story, including ingress rows that currently only exist in the legacy heartbeat ledger.
- `runtime-ui-publication`: The client/runtime publication contract must hydrate and live-merge one unified Heartbeat slice from all durable ingress sources needed by the Heartbeat panel.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, `packages/webui`
- Affected APIs: `runtime.heartbeatPartsPage`, realtime `runtime.heartbeatPart` publication semantics
- Affected systems: runtime session ledger projection, Heartbeat browser hydration, real browser verification flow
