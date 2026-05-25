## Context

Two visible regressions share the same shape: product projections are leaking implementation residue as if it were truth.

In `cli-shell`, tmux is only the local compositor, but the current Chat/Help handling is spread across status ranges, session options, pane discovery, popup commands, and OpenTUI layout callbacks. Because no single state transition owns the Chat surface, a layout switch can open a second Room surface before the previous one has been closed, or clear the highlight while a surface still exists.

In Studio Terminals, TerminalSystem already defines one `terminal_instance` truth with live/history/archive projections. `terminal list` and the default `/terminals/*` workbench must represent live instances only, while killed instances belong to the explicit history/index route. Seeing killed instances in default terminal navigation means a projection boundary is broken, not that a second history table is needed.

## Goals / Non-Goals

**Goals:**

- Make tmux status clicks normalize to product actions before dispatch, so `help`, `user|help`, and equivalent range payloads do not diverge.
- Make Chat a singleton presentation surface per tmux session: exactly one of closed, popup, or pane.
- Make Chat layout buttons move that singleton surface instead of starting another Room owner.
- Make status-bar `Chat` a true toggle and restore shell focus/highlight after close.
- Make Studio default terminal navigation select only live terminal records.
- Make terminal history/index show live records first and killed records after them, sorted by killed time, while still reading from the canonical terminal instance projection.

**Non-Goals:**

- Do not move cli-shell state into TerminalSystem, MessageSystem, or AvatarRuntime.
- Do not resurrect terminal-1/terminal-2 composed-surface behavior.
- Do not add a second `terminal_history` durable table.
- Do not redesign the whole terminal-system workbench visual language.

## Decisions

### 1. Normalize tmux status ranges at the action boundary

`tmux-action` is the canonical product action boundary. It will normalize known action strings and `range=user|<action>` style strings into the same action enum before execution.

Alternative considered: encode only pure action names in `range=user|...` and assume tmux always returns the argument. That keeps tests small but leaves the product dependent on tmux range serialization details. Normalization is cheaper and more robust.

### 2. Model Chat as one session-local surface state

The implementation will treat these as the only legal Chat states:

```txt
closed
popup
pane:<pane-id>
```

The state is presentation-local and stored in tmux session options. Pane discovery can repair stale `pane:<id>` state if the pane no longer exists, but discovery does not create a second owner.

Alternative considered: keep `@agenter_cli_shell_chat_surface` and `@agenter_cli_shell_chat_pane` as loosely coupled fields. That is the current failure mode: one field can say popup while an old pane still exists.

### 3. Put tmux operations behind a generic SDK boundary

`tmux-host` still needs short `run-shell` launcher commands because tmux status/key bindings execute inside tmux, but the real product action path must use a typed tmux client for session options, pane discovery, pane moves, popup display, and focus changes.

The new `@agenter/tmux-client` package is intentionally generic: it only models tmux sessions, panes, options, popups, bindings, command execution, and parsing. It must not import or name cli-shell, Avatar, MessageRoom, TerminalSystem, or Studio. It exports TypeScript source directly so local development remains ts-first and does not depend on `dist`.

Alternative considered: keep extending `tmux-host.ts` with hand-built full shell scripts. That makes every layout transition a string-concatenation exercise, hides topology bugs from TypeScript, and makes singleton Chat behavior hard to test without spawning a real tmux session.

### 4. Split user intent from layout move intent

`Chat` from the status bar means toggle. `pane` means explicit dock fallback. `layout-left/right/cover` means move the already visible Chat surface or open the singleton in that shape if it was closed. The OpenTUI Room titlebar requests layout; it does not decide which old surface should be killed after the request.

Alternative considered: make the current Room process decide whether it should quit after every layout request. That forces a child surface to own global tmux topology and causes the repeated double-open/closed-highlight bugs.

### 5. Keep terminal live/history/archive as projections over one terminal instance truth

The control plane remains the source of truth. Live APIs return non-killed and non-archived records. History/index APIs return the union projection needed by the route: live first, killed history after, sorted by killed timestamp. Studio may visually group the projection, but it must not merge raw local caches to redefine lifecycle.

Alternative considered: let Studio combine `globalTerminals` and `globalTerminalHistory` itself. That duplicates ordering and projection law in the frontend and has already led to route-level confusion.

## Risks / Trade-offs

- [Risk] tmux popup cannot be introspected as reliably as panes. → Mitigation: popup state is set before opening and restored on command exit; layout-to-pane closes current popup from the host action, while pane state is validated by pane discovery.
- [Risk] existing sessions may carry stale session options. → Mitigation: every action normalizes stale pane state before deciding and can reset to `closed` when discovery fails.
- [Risk] history/index sorting depends on killed timestamp quality. → Mitigation: use `lastStoppedAt` first, then `updatedAt` as fallback for older records.
- [Risk] frontend and backend projections can drift again. → Mitigation: add BDD tests at terminal control/store/studio route boundaries and keep the projection named in specs.

## Migration Plan

This is a breaking cleanup with no compatibility layer. Existing tmux sessions may be restarted or their session options overwritten by the next `agenter shell` launch. Existing terminal database rows remain valid because live/history/archive are projections over the same terminal catalog.
