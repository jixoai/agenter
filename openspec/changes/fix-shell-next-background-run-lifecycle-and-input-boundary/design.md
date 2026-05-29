## Context

Shell-next currently has the right high-level split:

- OpenCompose and renderable mux own layout, chrome, and pane composition.
- Terminal semantics already live in source-owned adapters and `@agenter/termless-backend-utils`.
- Product-level app code still owns global shortcuts, top-layer orchestration, and attach/runtime lifecycle.

The remaining gap is not “more generic input plumbing”. It is an ownership boundary:

- `Run in Background` is the same as closing a native terminal window/tab: it closes the shell-next attach client.
- `Terminate terminal` must remain the destructive exit mode.
- Product command launch must not create an in-process daemon and stop it when the foreground product exits.

The input-boundary question is smaller. It is a verification pass to ensure no terminal-specific semantic handling has leaked back up into shell-next app/view code.

## Goals

- Make background exit a plain attach-client close, not a terminal/resource lifecycle action.
- Keep attached terminals selectable after a background exit.
- Ensure product commands run against a managed daemon authority whose lifecycle is explicit daemon start/stop/restart, not foreground product lifetime.
- Keep terminal-specific input semantics owned by the terminal source/backend boundary.
- Leave `extensions/cli-shell` untouched.

## Decisions

### 1. Background close is not a resource lifecycle mode

`ShellNextApp` should only model the foreground UI attachment ending.

- `Run in Background` closes the UI and disposes only local renderer/source/client resources.
- Product-bound live source `dispose()` disconnects the local mirror/transport; it does not stop the durable PTY.
- Local Bun PTY source `dispose()` closes its local process because local mode has no daemon-owned durable terminal.
- `Terminate terminal` is the only close-confirm action that calls terminal source `terminate()`.

This avoids inventing a special `detach` lifecycle action in shell-next just to describe ordinary client close.

### 2. Product launcher owns daemon authority, not daemon shutdown

The real disappearing-selector failure came from the CLI product launcher starting an in-process daemon and stopping it when the product returned. That stopped TerminalSystem and removed live shell-next terminals.

- Product command launch should ensure or reuse a managed background daemon authority.
- Foreground product exit should never stop the daemon or daemon-owned terminals.
- `agenter daemon stop` and `agenter daemon restart` remain the explicit daemon shutdown authorities.

The attach runtime can still call `store.disconnect()` and `client.close()` because those release local SDK transport/subscription resources, not daemon-owned PTYs.

### 3. Terminal input stays below the app layer

The terminal boundary remains:

- `packages/termless-backend-utils` for host input state machines;
- terminal sources/mirrors for binding those machines to concrete terminal backends;
- OpenCompose/framebuffer code for raw forwarding and coordinate translation only.

Allowed above the boundary:

- `Ctrl+B` / product shortcuts;
- top-layer dialog routing;
- pane focus orchestration;
- renderer-level clipboard projection.

Not allowed above the boundary:

- durable terminal selection semantics;
- semantic word/line selection ownership;
- backend follow-cursor transaction logic;
- primary clipboard fallback state.

### 4. Keep the audit honest

If any terminal-specific input logic is still found in shell-next app/view code, move it down or delete it. If it is only product-global routing, keep it and document it as such.

## Risks

- The current attach/close path may need one more explicit lifecycle hook if the server interprets a graceful websocket close as terminal/session termination.
- Input ownership is already mostly in the right place; the risk here is over-fixing by moving product-global shortcuts into the kernel boundary.

## Implementation Shape

1. Change product command launch to ensure/reuse a managed daemon authority instead of owning an in-process daemon handle.
2. Remove shell-next `background-run` detach/outcome plumbing.
3. Let `Run in Background` call normal app destroy; let `Terminate terminal` explicitly call `terminate()` before app destroy.
4. Audit shell-next input handlers and leave only product-global routing above the terminal boundary.
5. Re-run focused BDD, then self-review the drift list in plain language.
