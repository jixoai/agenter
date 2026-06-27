## Why

`shell-next` already proves the embedded OpenTUI mux and FrameBuffer terminal projection path, but it still starts as a local BunPTY/demo runtime. To make it a real replacement candidate for tmux-backed `cli-shell`, `shell2` must attach to the same daemon/client-sdk app resources that `cli-shell` owns today.

## What Changes

- Keep `agenter shell2` as the shell-next incubation entry until the user explicitly accepts it.
- Add a shell-next app runtime path that bootstraps Avatar/session, TerminalSystem terminal binding, MessageSystem room binding, managed state, settings, and launcher daemon context.
- Make live TerminalSystem transport the default shell-next terminal source while keeping Local BunPTY as an explicit dev/local source family.
- Replace placeholder Chat and empty approval surfaces with Room-backed Chat and TerminalSystem approval wiring.
- Connect the shell-next statusbar to real heartbeat, AttentionContext, and AI context summaries.
- Add cli-shell-compatible argv and command handling where it is app-runtime behavior, while rejecting tmux-only action semantics.
- Prepare shared terminal projection/live-mirror atoms for extraction so shell-next can later stop depending on legacy `agenter-app-shell`.

## Capabilities

### New Capabilities

- `shell-next-app-runtime`: shell-next app attach/runtime behavior, including bootstrap, live terminal, Room, approval, statusbar, settings, and shell2 incubation constraints.

### Modified Capabilities

- `app-command-launcher`: `shell2` remains temporary, but its descriptor must reflect daemon-backed shell-next runtime once attach is implemented.
- `cli-shell-app`: cli-shell's replaceable local host law is exercised by shell-next without changing TerminalSystem, MessageSystem, AvatarRuntime, AttentionSystem, or app binding truth.

## Impact

- Affects `apps/shell-next`, focused launcher descriptor/tests in `packages/cli`, and any extracted shared atoms currently reused from `apps/cli-shell`.
- Does not switch stable `agenter shell` to shell-next in this change.
- Does not introduce tmux/psmux or a native addon into shell-next.
