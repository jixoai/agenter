## Context

Shell-next currently has the right high-level split:

- OpenCompose and renderable mux own layout, chrome, and pane composition.
- Terminal semantics already live in source-owned adapters and `@agenter/termless-backend-utils`.
- Product-level app code still owns global shortcuts, top-layer orchestration, and attach/runtime lifecycle.

The remaining gap is not “more generic input plumbing”. It is an exit-mode boundary:

- `Run in Background` must be a non-destructive exit mode.
- `Terminate terminal` must remain the destructive exit mode.

The input-boundary question is smaller. It is a verification pass to ensure no terminal-specific semantic handling has leaked back up into shell-next app/view code.

## Goals

- Make background exit and terminal termination two different product outcomes.
- Keep attached terminals selectable after a background exit.
- Keep terminal-specific input semantics owned by the terminal source/backend boundary.
- Leave `extensions/cli-shell` untouched.

## Decisions

### 1. Exit mode must be explicit

`ShellNextApp` should not just resolve `finished`; it should remember how it exited.

- `background-run` means close the UI and preserve the attached terminal binding.
- `background-run` may detach a product-bound view transport so the shell-next process can exit, but it must not stop the durable PTY.
- `terminate` means close the UI and stop/kill the attached terminal.

This avoids a future regression where both close buttons converge on the same teardown path.

### 2. Product runtime must branch on exit mode

The attach runtime should not infer lifecycle intent from `app.finished` alone.

- Background exit should skip any destructive cleanup that would hide or kill the attached terminal.
- Terminal termination should keep the current destructive cleanup.

If the current server/client boundary does not yet expose a dedicated detach path, that gap must be named rather than hidden behind a generic close.

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

1. Add an explicit shell-next exit-mode signal.
2. Thread that signal through close-confirm and product runtime.
3. Keep terminal termination destructive and background exit non-destructive.
4. Audit shell-next input handlers and leave only product-global routing above the terminal boundary.
5. Re-run focused BDD, then self-review the drift list in plain language.
