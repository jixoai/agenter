## Context

The user target is explicit: terminal rendering should not stay trapped inside the current WebUI implementation. Instead, terminal-system should publish data transport, and a standalone `terminal-view` WebComponent should own the renderer behavior. This is partly a code-ownership problem and partly a layout-quality problem: xterm surfaces need a clean scroll contract and should not inherit WebUI-specific overflow mistakes.

Current building blocks:
- WebUI already hosts a terminal panel and xterm integration experiments.
- terminal-system is gaining a websocket PTY transport contract.
- the project already uses Storybook DOM and browser walkthroughs for UI contract verification.

The missing layer is a standalone renderer package with an explicit transport and layout contract.

## Goals / Non-Goals

**Goals:**
- Create a standalone `terminal-view` WebComponent implemented with `lit.js`.
- Consume websocket PTY transport rather than bespoke WebUI runtime wiring.
- Define clear scroll ownership and scrollbar behavior for the terminal surface.
- Keep WebUI integration thin and compositional.

**Non-Goals:**
- Rebuild the entire shell/navigation system around the new component.
- Ship remote/multi-tenant terminal transports.
- Solve every terminal theming feature in the first slice.

## Decisions

### Renderer becomes a package, not a feature helper
`terminal-view` lives as a standalone package and exports a standard WebComponent.

Why: this enforces separation between renderer infrastructure and WebUI product surfaces.

### Transport stays websocket-based
The component connects through the terminal-system websocket PTY transport contract and does not require app-server-local render bindings.

Why: transport should be portable across renderer hosts.

### Scroll ownership is explicit
The terminal viewport owns one scroll container with visible scrollbar support; outer shells should not add competing nested scroll containers around the renderer.

Why: terminal rendering is especially sensitive to overflow mistakes, and the user explicitly called out scrollbar correctness.

### Verification mixes DOM contract and browser walkthroughs
The component itself gets DOM contract coverage, while embedded WebUI usage also gets browser-level validation for actual scrolling.

Why: terminal rendering problems often appear only with real layout and viewport behavior.

## Risks / Trade-offs

- [Package extraction churn] -> splitting the renderer out can temporarily duplicate integration glue; keep the first adapter thin.
- [xterm layout quirks] -> scrollbar correctness can regress across hosts; define scroll ownership rules in spec and test them explicitly.
- [Transport lifecycle] -> websocket reconnect/cleanup behavior must be explicit to avoid orphaned sessions.

## Migration Plan

1. Define standalone renderer and transport-consumer specs.
2. Create the `terminal-view` package and its WebComponent contract.
3. Adapt WebUI terminal surfaces to consume the component.
4. Add DOM/browser verification for rendering and scroll behavior.
5. Retire product-local renderer glue once the standalone component is stable.

## Dependencies and Handoff

**Inbound dependencies:**
- Depends on `modernize-terminal-control-plane` for PTY websocket transport and process metadata.
- Depends on `propagate-terminal-contract-to-clients` for the host-side runtime contract used by WebUI embedding surfaces.

**Implementation boundary:**
- This change owns the standalone renderer package and its host integration contract.
- It does not own terminal lifecycle APIs, runtime publication schemas, or source adapter semantics.
