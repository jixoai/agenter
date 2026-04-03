## Why

The terminal-system route currently loses trustworthy rendering after refresh: running terminals can appear blank, the durable snapshot/transport facts do not reliably survive hydration, and the operator cannot trust the page without manual refreshes or incidental live updates. This must be repaired at the control-plane and client projection level before more surface polish is added.

## What Changes

- Repair global terminal hydration so durable snapshot, live transport URL, renderer metadata, and absolute cwd remain available after refresh.
- Tighten the client runtime store so global terminal catalog entries are reconciled from one terminal truth and stay aligned with live terminal events instead of drifting into empty route state.
- Keep the terminal operator route subscribed to live terminal activity, seat/access state, and call-as options without requiring manual refresh after mutations.
- Ensure terminal rendering uses the shared `terminal-view` contract consistently in the real route and test harnesses, so route verification exercises the same live rendering path.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `terminal-system-surface`: the operator route must restore durable renderable terminal state after refresh and keep live seat/activity state coherent.
- `terminal-view-component`: shared terminal view hosts must hydrate from durable snapshot truth and continue seamlessly into live transport.
- `client-runtime-store`: global terminal normalization must preserve render-critical facts across refresh and incremental updates.

## Impact

- Affected systems: `terminal-system`, `app-server`, `client-sdk`, `terminal-view`, `webui`
- Affected APIs/contracts: global terminal list payload, live runtime event reconciliation, terminal host hydration props
- Affected tests: terminal route DOM stories, client runtime store regressions, route-level refresh/render verification
