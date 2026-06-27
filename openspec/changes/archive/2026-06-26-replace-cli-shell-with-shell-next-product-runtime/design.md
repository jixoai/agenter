## Context

`shell-next` currently has a app-free renderable mux, layout tree, protocol pane boundary, FrameBuffer terminal projection, and visible Help/Chat/statusbar actions. The stable `agenter shell` command still routes to tmux-backed `agenter-app-shell`; `agenter shell2` routes to local-only `agenter-app-shell-next`.

The replacement gap is app runtime parity. `shell-next` starts local BunPTY panes today, while `cli-shell` performs daemon/client-sdk bootstrap, Avatar/session selection, TerminalSystem binding, MessageSystem Room binding, settings, managed attention state, approval top layer, and heartbeat status.

## Goals / Non-Goals

**Goals:**

- Keep `agenter shell2` as the incubation entry until user acceptance.
- Make shell-next's default app path attach to real daemon/client-sdk resources.
- Reuse the existing terminal protocol and FrameBuffer projection stack without importing tmux host behavior.
- Render Room, approvals, Help, and statusbar as OpenTUI-native shell-next surfaces.
- Preserve `agenter shell` and the existing cli-shell behavior during incubation.

**Non-Goals:**

- Do not rename `apps/cli-shell` or switch `agenter shell` in this change.
- Do not emulate tmux actions or status-bar dispatch in shell-next.
- Do not treat Local BunPTY as fallback for failed app attach.
- Do not publish shell-next or introduce a native addon.

## Decisions

### 1. App attach is a separate shell-next runtime mode

`runShellNext` will parse cli-shell-compatible app argv and start a app attach mode by default. It will create a daemon client/store, auto-login through existing store behavior, resolve session/avatar selection, bootstrap terminal and room bindings, and then start `ShellNextApp` with app-bound sources and surfaces.

Local BunPTY remains an explicit dev/local source mode through `--command` or future dev-only commands. It is not a fallback if daemon attach fails.

### 2. TerminalSystem live transport is the default terminal source

The initial shell pane will use `CliShellLiveTerminalProtocolSource` with the attached terminal id, transport URL, and snapshot. This preserves TerminalSystem as terminal truth and keeps shell-next as projection/layout/input routing.

Additional split terminal panes should create their own app terminal bindings or explicitly use the chosen local source policy; they must not silently duplicate the same transport source.

### 3. Room and approvals are OpenTUI app surfaces, not terminal panes

Chat will become a Room-backed OpenTUI renderable source that consumes MessageSystem room snapshots and send APIs. Approval will use a shell-next approval store adapter over TerminalSystem approval APIs. Room may make approval visibility discoverable, but approval truth stays in TerminalSystem.

### 4. Statusbar uses real macro facts

The shell-next statusbar will reuse the same macro information currently exposed by cli-shell heartbeat/status and Studio-style attention/context derivation where practical. It will not render AttentionItem bodies.

### 5. Shared atoms must leave the legacy app boundary before replacement

During incubation, shell-next may import safe cli-shell atoms to move quickly. Before claiming replacement readiness, shared terminal projection/live mirror/settings/keybinding atoms must be extracted or relocated so stable shell-next does not depend on legacy `agenter-app-shell` as a runtime package.

## Risks / Trade-offs

- [Risk] Reusing cli-shell atoms can keep a hidden dependency on legacy tmux app code. Mitigation: only import classified safe atoms and add tests that shell-next mux/core does not import tmux host modules.
- [Risk] Live terminal split behavior is more complex than local BunPTY cloning. Mitigation: implement initial attach first, then define explicit source policy for new splits.
- [Risk] Room direct rendering may expose assumptions from the old Room app. Mitigation: adapt it behind a pane-scoped OpenTUI surface interface, not a tmux layout interface.
- [Risk] Descriptor changes could accidentally switch stable shell. Mitigation: keep `shell` descriptor unchanged and assert this in launcher tests.

## Migration Plan

1. Add shell-next app attach argv and bootstrap path behind `shell2`.
2. Switch default `shell2` runtime from Local BunPTY to live TerminalSystem source.
3. Wire Room, approval, statusbar, settings, and command compatibility.
4. Extract shared atoms currently imported from legacy cli-shell.
5. Run side-by-side acceptance of `shell` and `shell2`; only after user acceptance open a separate rename/switch change.
