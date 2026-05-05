## Context

The current terminal lifecycle behavior mixes two different classes of concern:

- product chrome projections (`page-toolbar`, `terminal-window` titlebar)
- lifecycle ownership (`bootstrap`, `kill`)
- live transport lifecycle (`running` vs `stopped`)

That split is currently leaky in two ways. First, the same lifecycle fact is rendered through two controls that can evolve independently, which is how confirmation and labeling drift happens. Second, live transport reconnect currently depends on `transportUrl` mutation, even though the transport projection is supposed to remain durable across stopped state.

## Goals / Non-Goals

**Goals**
- Make terminal lifecycle actions route-owned and project them consistently through both toolbar surfaces.
- Require a single kill confirmation flow regardless of which lifecycle projection the operator clicks.
- Preserve the law that bootstrap starts from current durable terminal config instead of opening an inline parameter editor.
- Allow live websocket reconnect after `kill -> bootstrap` even when transport discovery is unchanged.
- Keep stopped terminals renderable from durable snapshot truth while preventing stale live websocket writes.

**Non-Goals**
- Add bootstrap parameter UI to the lifecycle buttons.
- Redesign the broader terminal actions/users layout.
- Change terminal transport wire format or authorization policy.
- Archive the OpenSpec change in this round.

## Decisions

### 1. Lifecycle ownership lives in `terminal-system-surface`

`terminal-system-surface` becomes the single lifecycle action owner. `page-toolbar` and `terminal-window` titlebar are only view projections that emit `TerminalLifecycleAction`.

Why:
- This keeps causality explicit: the route owns lifecycle side effects, while chrome surfaces stay orthogonal.
- It prevents divergence in copy, disable rules, confirmation rules, and busy state.

Rejected alternative:
- Keep separate `onBootstrapTerminal` / `onStopTerminal` handlers per surface.
- Rejected because that duplicates lifecycle policy in multiple projections.

### 2. Kill uses confirmation; bootstrap does not become a config editor

`kill` is destructive to live PTY state and therefore always routes through a confirmation dialog. `bootstrap` remains a direct lifecycle action that uses the current durable terminal config. Launch parameters belong to the terminal config/edit surface, not to lifecycle buttons.

Why:
- This matches the user-approved operator model.
- It preserves the separation between lifecycle control and durable configuration.

Rejected alternative:
- Put launch parameter editing behind the bootstrap button itself.
- Rejected because it overloads a simple lifecycle primitive with config ownership and would immediately diverge between titlebar and page-toolbar.

### 3. Live transport truth is gated separately from transport discovery

The host keeps passing the durable transport URL, but it separately controls whether live transport is enabled. `terminal-view` must react to either transport URL changes or live-transport enablement changes.

Why:
- A stopped terminal may still expose transport discovery for snapshot hydration and later reconnect.
- Requiring a new URL to reconnect is the wrong coupling; lifecycle truth and endpoint discovery are different facts.

Rejected alternative:
- Clear transport discovery on stop so reconnect always depends on a new URL.
- Rejected because it conflicts with the stopped-terminal transport discovery law and throws away a stable endpoint unnecessarily.

### 4. Gesture-sourced resize remains orthogonal to lifecycle

This change does not move resize ownership. Live resize remains gesture-sourced and independent of bootstrap/kill, which avoids reintroducing hidden side effects into lifecycle actions.

Why:
- The route already has a clean separation between resize gestures, durable resize form submission, and lifecycle.
- Mixing them would create another causality leak.

## Risks / Trade-offs

- **Story harness realism is still partial**: it preserves stopped transport discovery when present, but it still defaults to snapshot-only stories to avoid creating incidental websocket dependencies.
- **Stable URL reconnect adds another host prop**: `liveTransportEnabled` slightly expands the viewport host contract, but it keeps the dependency explicit and type-safe.
- **Confirmation flow can regress through overflow toolbar variants**: Storybook coverage must include the kill-confirm path so compact and wide toolbar projections stay aligned.
