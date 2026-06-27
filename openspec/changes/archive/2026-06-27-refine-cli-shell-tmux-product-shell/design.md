> Superseded note:
> This design preserves useful interaction stories for Help, Chat, status bar, and top-layer behavior.
> Its architecture conclusion that tmux session-local state is app truth is superseded by `realign-cli-shell-with-core-system-boundaries`.

## Context

The app boundary is now correct: cli-shell is an extension, and TerminalSystem is not its compositor. The app experience is still incomplete because the current tmux host only creates a split layout. It uses tmux as a process launcher, not as a app shell.

## Architecture Decision

### Chosen: tmux-native app shell

cli-shell will treat tmux as the local UI runtime:

- tmux session/window/pane identities are app-local.
- cli-shell uses its own tmux socket namespace, so app bindings never mutate the user's normal tmux server.
- session-specific values are stored as tmux user options on the cli-shell session.
- the primary pane remains the user's shell.
- the bottom tmux status line carries app chrome, with identity on the left and actions on the right.
- the default tmux window list is hidden for cli-shell sessions because it competes with the app action rail.
- Chat opens through a tmux popup by default, but the popup runs the OpenTUI MessageRoom surface; tmux is the host, not the Chat implementation.
- a Chat pane exists only as an explicit fallback/toggle path.
- the OpenTUI Chat titlebar can close the active surface and request `◨` left dock, `◧` right dock, or `⿴` cover layout, but those requests are executed by tmux actions rather than by resizing Chat's internal OpenTUI renderables.
- key bindings are declared by cli-shell and installed into the tmux session.
- key/status bindings delegate to a short `tmux-action` subcommand instead of embedding full popup or pane command strings into tmux bindings.
- tmux mouse support is enabled by default so the status bar is clickable for non-tmux users.
- Mouse can be toggled explicitly with `Ctrl+b`, then `m`; turning it off restores native terminal selection but disables status clicks until it is turned on again.
- a Help entry is visible and clickable from the status bar, and opens the same shortcut guide as the keyboard binding.

This keeps cli-shell outside TerminalSystem while restoring the app shell behavior users expect.

### Rejected: permanent split as the app UI

A permanent right-side room pane is not a app shell. It consumes screen width, hides the expected Chat entry, and drops the bottom status bar. It is acceptable as a fallback, not as the default.

### Rejected: rebuild OpenTUI composition outside tmux

Rebuilding the old OpenTUI compositor would reintroduce the same failure mode: cli-shell owns a bespoke terminal mixing layer. tmux already has windows, panes, status, popups, and key bindings; the extension should model those primitives directly.

## App Shell Story

When a user runs:

```bash
bun agenter shell --session=5 --avatar=bangeel
```

the first viewport should be the shell. The bottom status bar should make cli-shell visible:

```text
 cli-shell shell-5 @bangeel  managed:off  Help  Chat  Dock  Mouse:on  Shell
```

The user keeps working in the shell. When they want Chat, they press the configured Chat key and tmux opens a popup running the OpenTUI room UI:

```bash
agenter-cli-shell room --session=shell-5 --avatar=bangeel
```

If popup is disabled or unsupported, the fallback key opens a named Chat pane. That fallback must be explicit and reversible; it must not be the default layout.

Chat is a singleton app surface, not an event that blindly opens another container. The tmux session owns that singleton state through `@agenter_cli_shell_chat_surface`, `@agenter_cli_shell_chat_pane`, and `@agenter_cli_shell_active_action`. The `Chat` status entry first discovers an existing room pane for the same session and Avatar; if one exists, it focuses it. It only opens a popup when no Chat pane exists. Layout requests are transitions on that same singleton surface.

This state cannot live in a plain in-memory JS store because the visible app is split across tmux panes, popup processes, and repeated `tmux-action` invocations. tmux session options are the local app truth; OpenTUI Chat only emits intentions such as close, dock left/right, or cover.

Nested tmux calls inside `run-shell` have one important trap: the outer tmux command expands `#{...}` before the inner command runs. Any format meant for inner pane discovery must be written as `##{...}` in the outer command string, so the inner `tmux list-panes` receives the real `#{pane_id}` / `#{pane_start_command}` format.

Inside Chat, the titlebar offers close plus `◨` / `◧` / `⿴`. These are not Chat self-layout buttons. They are app-shell controls. For pane-to-pane left/right changes, cli-shell moves the existing pane with tmux instead of killing and restarting the OpenTUI Room process. For pane-to-cover changes, tmux cannot move a live pane into a popup, so cli-shell models that as an explicit surface conversion: close the pane and open a cover popup. This distinction must stay visible in the code and tests so future work does not accidentally turn every layout change into a Room restart.

The Room input line is an OpenTUI input surface, not a passive text line. It must show a cursor and own text editing behavior while keeping the existing send-on-enter contract.

Terminal write approvals do not belong inside the Room. Room is the MessageRoom surface; approvals are app-global shell chrome. cli-shell therefore owns a separate OpenTUI top surface (`shell top`) that can be launched as a tmux popup and subscribe to pending terminal approval requests. The top surface is allowed to use the same client-sdk/store APIs as Room, but its state, rendering, and mouse handling are independent. Room may nudge the app shell to open `shell top` when it observes pending approvals, but it must not render the approval card itself.

The top surface is a general app top layer, not a MessageRoom child. Today it renders terminal write approvals; later it can host app notifications without changing Room. Approval actions must be reachable by keyboard and mouse. The mouse hit test belongs to the top-layer OpenTUI renderables, not to Room absolute-coordinate regions.

The bottom status bar exposes the main visible actions. It does not repeat shortcut text as the main UI; the active surface is highlighted with tmux status styling:

- `managed:on/off` toggles cli-shell hosting attention for this tmux-hosted app session.
- `Help` opens the shortcut guide.
- `Chat` opens the Chat popup.

`Dock`, `Mouse`, `Shell`, and `Refresh` remain app-local expert key bindings. They should not occupy the right-side status action rail.

`managed:on/off` is a real switch, not a label. A status click dispatches the `managed` app action, which commits or settles cli-shell hosting attention and then writes the projected tmux option. This action stays in cli-shell extension code; it must never become a TerminalSystem field or a hard-coded core mode.

When Mouse is on, status clicks are handled by tmux and ordinary drag selection is captured by tmux. When Mouse is off, drag selection belongs to the native terminal, but status clicks are not available.

## Interaction Contract

- Default attach shall not permanently split the shell just to show Chat.
- Status line shall be installed before attach so the user sees app chrome immediately.
- Status action entries shall stay visible in common terminal widths instead of being pushed off screen by the default tmux window list.
- Mouse support shall be enabled before attach.
- Mouse shall be available through an explicit app key binding.
- Chat popup binding shall be present in the session.
- Chat shall be a singleton app surface: status click, key binding, dock fallback, and layout controls shall focus or transition the existing Chat surface instead of duplicating it.
- Chat popup and Dock pane shall use the launcher-provided cli-shell bin argv instead of guessing a path from `import.meta.url`.
- Chat popup and Dock pane shall run the active OpenTUI `room` surface, not a text-only room console fallback.
- OpenTUI Chat shall expose a close control in its titlebar.
- OpenTUI Chat titlebar layout controls shall delegate to cli-shell tmux layout actions, not mutate OpenTUI's own title/body/status/draft widths.
- Chat popup shall not disappear without explanation when the room command exits unexpectedly; it shall show the exit status and wait for the user to close it. A normal titlebar close or layout switch shall close the old surface immediately.
- Chat pane fallback binding shall be present but not executed during default attach.
- Help popup binding shall be present in the session.
- Status clickable ranges shall be installed through tmux `range=user|...` status format plus `MouseDown1Status`.
- Status entries shall highlight `@agenter_cli_shell_active_action` so open Help/Chat/Shell state is visible in the app chrome.
- App bindings shall pass `#{session_name}` and cli-shell session options through tmux format expansion into `tmux-action`; the real Help/Chat/managed/Dock/Mouse/Shell actions shall be executed by cli-shell extension code, not by long ad-hoc tmux command strings.
- Nested tmux formats used inside `run-shell` shall be deferred as `##{...}` when the format belongs to an inner tmux command.
- App status styling shall explicitly set a high-contrast cli-shell status palette and must not rely on `#[default]`, because that would inherit the user's global tmux theme and can make the app chrome unreadable.
- cleanup shall list and kill sessions through the same cli-shell tmux socket namespace that attach uses.
- All tmux commands shall remain data-planned before execution for BDD coverage.
- cli-shell-specific UI law shall remain inside `apps/cli-shell`.

## Key Defaults

- `Ctrl+b`, then `c`: open Chat popup.
- `Ctrl+b`, then `C`: open Chat dock pane.
- `Ctrl+b`, then `m`: toggle Mouse.
- `Ctrl+b`, then `s`: focus shell pane.
- `Ctrl+b`, then `r`: refresh cli-shell status options.
- `Ctrl+b`, then `?`: open the shortcut help popup.

The exact keys are app-local defaults and can later become config, but this change keeps them deterministic for tests and usability.
