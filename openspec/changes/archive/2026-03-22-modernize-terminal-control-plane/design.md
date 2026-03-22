## Context

`loopbus-attention-first-plugin-pipeline` establishes attention-first ingestion and starts the terminal tool migration, but it stops at the app-server boundary. The product target is broader: terminal-system itself should own terminal lifecycle, process profiles, websocket transport, and the canonical control-plane contract. If we leave these concerns in app-server glue, future consumers such as standalone `terminal-view`, client-sdk, or plugin-driven systems will keep depending on runtime-specific behavior instead of a reusable service contract.

Existing code already provides useful primitives:
- `AgenticTerminal` / `ManagedTerminal` model process state, rendering, and dirty tracking.
- app-server already knows how to expose terminal tools and focus state.
- settings schema already has partial terminal preset support.

The missing layer is a terminal-system-owned control plane with stable contracts for lifecycle, metadata, transport, and inspection.

## Goals / Non-Goals

**Goals:**
- Move terminal lifecycle authority toward terminal-system.
- Define one coherent API family for focus/read/snapshot/write/create/list/kill/config.
- Support declarative process profiles (`icon`, `title`, `shortcuts`) with sensible defaults.
- Expose websocket PTY transport in a way renderer consumers can rely on.

**Non-Goals:**
- Finish all client-sdk/webui migration in this change.
- Finalize the standalone renderer implementation itself; that belongs to a later change.
- Introduce remote multi-host terminal orchestration.

## Decisions

### Terminal-system is the control-plane owner
App-server may adapt the contract for model/runtime use, but terminal-system owns lifecycle semantics and the stable API model.

Why: this keeps terminal behavior reusable across backend, renderer, and future plugin consumers.

### Focus stays declarative and set-based
The canonical operation remains `terminal_focus({ op, terminalIds })` with `add/remove/replace/clear` semantics.

Why: it is replay-safe, easy to reason about, and composes with multiple focused terminals.

### Read and snapshot remain the only inspection primitives
`terminal_read` returns the shorter representation between diff and snapshot unless explicitly overridden; `terminal_snapshot` always returns the full representation.

Why: this preserves the AI-facing simplification goal while still allowing explicit full reads.

### Profiles are config, not ad-hoc UI hints
`icon`, `title`, and `shortcuts` are part of process profile config and can be set per process or per process kind.

Why: these properties shape both AI affordances and UI presentation, so they need one source of truth.

### Transport is endpoint-driven
terminal-system exposes a websocket endpoint shaped like `ws://localhost:$PORT/pty/$TERMINAL_PID`, with the listening port discoverable through config APIs and live terminal ids discoverable through list APIs.

Why: renderer consumers need a simple endpoint contract rather than app-specific wiring.

## Risks / Trade-offs

- [Ownership shift] -> moving control-plane authority into terminal-system may require temporary adapter layers in app-server.
- [Config sprawl] -> process profile config can grow quickly; keep the first slice limited to icon/title/shortcuts and defaults.
- [Transport lifecycle] -> websocket transport introduces resource management and cleanup complexity; keep the first contract localhost-only.

## Migration Plan

1. Define terminal control-plane and process-profile specs.
2. Add terminal-system APIs for list/create/kill/focus/read/snapshot/write/config.
3. Add websocket transport publishing and endpoint discovery.
4. Keep app-server as an adapter over the new terminal-system APIs until consumer migration completes.
5. Verify with integration tests before moving renderer consumers.

## Dependencies and Handoff

**Inbound dependencies:**
- Depends on `integrate-message-terminal-attention-sources` for the already-decided focus-set and attention ingestion semantics.
- Reuses LoopBus/runtime publication contracts from `refactor-loopbus-attention-runtime` where terminal state is surfaced.

**Outbound handoff:**
- `propagate-terminal-contract-to-clients` consumes the canonical terminal payloads emitted from this control plane.
- `extract-terminal-view-webcomponent` consumes the websocket PTY transport and process metadata defined here.

**Implementation boundary:**
- This change owns terminal-system APIs, config, and PTY transport.
- It does not own WebUI renderer extraction or client-side view composition beyond app-server adaptation.

## Open Questions

- Whether terminal create should support named presets directly or only raw process descriptors in the first slice.
- Whether shortcut config should be normalized into semantic actions immediately or continue to accept simple key strings first.
