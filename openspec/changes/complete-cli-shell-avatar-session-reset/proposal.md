## Why

Recent cli-shell verification still reuses old Avatar runtime context, prompt-window history, and product terminal state when the user only changes `--session`. That makes it hard to launch cli-shell with a named ordinary Avatar whose runtime session is empty, and it also masks product bugs such as the guard authorization popup being implemented in component tests but not reliably visible in the real cli-shell terminal.

This change finishes the leftover cli-shell product work as one product-boundary cleanup: explicit Avatar startup flags, precise runtime-session clear semantics, current-terminal Shell Assistant targeting, and live authorization UI inside cli-shell. WebUI remains an independent product and does not gain cli-shell-specific controls.

## What Changes

- Add cli-shell attach flags:
  - `--avatar=<nickname>` selects the target Avatar by nickname.
  - `--create-avatar` creates the selected Avatar when it does not exist.
  - `--clear-avatar` clears the selected Avatar's current runtime session context before attach.
- Keep `--session` product-local: it still names the cli-shell terminal/room resource key such as `shell-2`, and it never becomes an AvatarRuntime identity axis.
- Preserve product/core isolation: cli-shell uses generic product-extension, session, Avatar catalog, TerminalSystem, MessageSystem, and attention APIs; core runtime modules do not branch on cli-shell flags or Avatar names.
- Define clear scope so selected Avatars can start with empty runtime conversation/model-call history while preserving canonical Avatar assets such as `AGENTER.mdx`, avatar memory files, profile media, and principal identity.
- Do not introduce any special Avatar type, mode, classify value, prompt template, or memory pack for this startup flow. `--avatar` selects an ordinary Avatar; creation and clearing are explicit operational flags.
- Do not couple WebUI to cli-shell. WebUI remains an independent product surface, not a cli-shell launcher or repair panel.
- Close the authorization popup gap by making cli-shell subscribe to the currently opened TerminalSystem instance, and by proving Shell Assistant writes target that same terminal instead of a hidden/internal terminal or workspace bash substitute.
- Keep terminal-view permission projection terminal-local: a terminal view renders approval requests for the terminal it is currently opened on. It does not widen subscription scope to compensate for wrong write targeting.
- Require native `shell-terminal-view` and cli-shell `--web` to show default approval UI for the currently opened terminal and support host callbacks, with real-product validation rather than component-only proof.
- Require real-AI cli-shell validation with a named ordinary Avatar proving the model uses the bound TerminalSystem, sees approval pending/approved/denied correctly, and does not fall back to unrelated `root_bash` / `workspace_bash` for visible terminal operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-shell-product`: add explicit Avatar startup flags, ordinary Avatar creation, runtime-session clear semantics, and current-terminal permission popup behavior.
- `product-extension-runtime`: expose product-safe Avatar ensure and runtime-session clearing through generic contracts without adding cli-shell-specific core branches.
- `avatar-runtime-topology`: preserve Avatar-only runtime identity while allowing product startup to clear a selected Avatar's current session context.
- `shell-assistant-avatar`: clarify that shell-assistant must target the current cli-shell terminal for room-bound terminal work and treat guard approval as terminal-local pending work.
- `terminal-view-component`: keep permission approval UI terminal-local and verify the default TopLayer UI works in real hosts, not only component tests.

## Impact

- `packages/cli-shell/src/argv.ts`, `bootstrap.ts`, `run-cli-shell.ts`, cleanup/session-clear helpers, fake store fixtures, startup tests, real-AI integration tests, and README/help output.
- `packages/client-sdk/src/product-extension-runtime.ts`, runtime store session deletion/retention behavior, and product-extension tests.
- `packages/cli-shell/src/tui/core-app.ts`, `shell-terminal-view.ts`, web host projection code, and current-terminal permission subscription wiring.
- `packages/terminal-view` permission request properties, callback semantics, default HTML Popover TopLayer UI, and host integration tests.
- Durable docs in `packages/cli-shell/SPEC.md`, `packages/product-extension-runtime/SPEC.md`, and affected OpenSpec capability specs.
