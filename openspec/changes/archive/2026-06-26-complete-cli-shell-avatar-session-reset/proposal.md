> Boundary note:
> This change remains relevant for `--avatar`, `--create-avatar`, and `--clear-avatar` semantics.
> But any cli-shell terminal-identity or browser-host wording must now be read through `realign-cli-shell-with-core-system-boundaries`: cli-shell targets one bound TerminalSystem terminal, `apps/cli-shell` is the current app package, and browser-host experiments are historical input only.

## Why

Recent cli-shell verification still reuses old Avatar runtime context, prompt-window history, and app terminal state when the user only changes `--session`. That makes it hard to launch cli-shell with a named ordinary Avatar whose runtime session is empty, and it also masks app bugs such as the guard authorization popup being implemented in component tests but not reliably visible in the real cli-shell terminal.

This change finishes the leftover cli-shell app work as one app-boundary cleanup: explicit Avatar startup flags, precise runtime-session clear semantics, current-terminal Shell Assistant targeting, and live authorization UI inside cli-shell. WebUI remains an independent app and does not gain cli-shell-specific controls.

## What Changes

- Add cli-shell attach flags:
  - `--avatar=<nickname>` selects the target Avatar by nickname.
  - `--create-avatar` creates the selected Avatar when it does not exist.
  - `--clear-avatar` clears the selected Avatar's current runtime session context before attach.
- Keep `--session` app-local: it still names the cli-shell terminal/room resource key such as `shell-2`, and it never becomes an AvatarRuntime identity axis.
- Preserve app/core isolation: cli-shell uses generic app-extension, session, Avatar catalog, TerminalSystem, MessageSystem, and attention APIs; core runtime modules do not branch on cli-shell flags or Avatar names.
- Define clear scope so selected Avatars can start with empty runtime conversation/model-call history while preserving canonical Avatar assets such as `AGENTER.mdx`, avatar memory files, profile media, and principal identity.
- Do not introduce any special Avatar type, mode, classify value, prompt template, or memory pack for this startup flow. `--avatar` selects an ordinary Avatar; creation and clearing are explicit operational flags.
- Do not couple WebUI to cli-shell. WebUI remains an independent app surface, not a cli-shell launcher or repair panel.
- Close the authorization popup gap by making cli-shell subscribe to the current bound TerminalSystem terminal, and by proving Shell Assistant writes target that same terminal instead of a hidden/internal terminal or workspace bash substitute.
- Keep terminal-view permission projection terminal-local: a terminal view renders approval requests for the terminal it is currently opened on. It does not widen subscription scope to compensate for wrong write targeting.
- Require native `shell-terminal-view` to show default approval UI for the current bound terminal and support host callbacks, with real-app validation rather than component-only proof.
- Require real-AI cli-shell validation with a named ordinary Avatar proving the model uses the bound TerminalSystem, sees approval pending/approved/denied correctly, and does not fall back to unrelated `root_bash` / `workspace_bash` for bound terminal operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-shell-app`: add explicit Avatar startup flags, ordinary Avatar creation, runtime-session clear semantics, and current-bound-terminal permission popup behavior.
- `app-runtime`: expose app-safe Avatar ensure and runtime-session clearing through generic contracts without adding cli-shell-specific core branches.
- `avatar-runtime-topology`: preserve Avatar-only runtime identity while allowing app startup to clear a selected Avatar's current session context.
- `shell-assistant-avatar`: clarify that shell-assistant must target the current bound cli-shell terminal for room-bound terminal work and treat guard approval as terminal-local pending work.
- `terminal-view-component`: keep permission approval UI terminal-local and verify the default TopLayer UI works in real hosts, not only component tests.

## Impact

- `apps/cli-shell/src/argv.ts`, `bootstrap.ts`, `run-cli-shell.ts`, cleanup/session-clear helpers, fake store fixtures, startup tests, real-AI integration tests, and README/help output.
- `packages/client-sdk/src/app-runtime.ts`, runtime store session deletion/retention behavior, and app-extension tests.
- `apps/cli-shell/src/tui/*`, `shell-terminal-view.ts`, and current-bound-terminal permission subscription wiring.
- `packages/terminal-view` permission request properties, callback semantics, default HTML Popover TopLayer UI, and host integration tests.
- Durable docs in `apps/cli-shell/SPEC.md`, `packages/app-runtime/SPEC.md`, and affected OpenSpec capability specs.
