> Superseded note:
> This change is built on the older `terminal-1` / `terminal-2` cli-shell architecture and must not be applied directly.
> Its web-host app goals may still be valuable, but the architecture must be rewritten under the boundary defined by `realign-cli-shell-with-core-system-boundaries`.

## Why

`separate-cli-shell-app-from-terminal-view-components` already corrected the durable platform law once, but the current discussion refines that law further: cli-shell is one termless app with terminal-1 as shell truth and terminal-2 as the visible app surface. The earlier `add-cli-shell-web-host` draft intentionally stopped short of redesigning `agenter shell --web`; it only kept that future path open.

Acceptance pressure now makes that future path immediate.

The current native-only `cli-shell` host is still a valid app surface, but it is a poor primary acceptance environment for interaction-heavy app walkthroughs because the owning native terminal program can block or rewrite shortcut delivery, GUI automation is fragile or policy-blocked, and host accessibility surfaces are weaker than the browser. These are host-environment constraints, not proof that the underlying terminal projection architecture is wrong.

The missing app capability is therefore not "another terminal backend". It is one additional official host mode for the same `cli-shell` app:

- keep terminal-1 as shell truth
- keep terminal-2 as final app-terminal truth
- keep protocol-1 as the raw transport substrate and protocol-2 as the derived shell-native composition mode built on it
- keep `web-terminal-view` as the Web protocol-1 projection primitive for terminal-2
- add an official `agenter shell --web[=PORT]` host mode that serves a shell-only Web surface
- keep launcher-owned daemon discovery authoritative for `cli-shell --web` startup, so default app launch reuses one healthy local daemon per runtime root instead of spawning a competing writer

This new host mode is valuable for two independent reasons:

1. It gives `cli-shell` a stronger app surface that can later evolve into a first-class Web-hosted shell experience.
2. It gives the project a more lawful acceptance surface for keyboard, pointer, wheel, resize, accessibility, and shared-viewport testing than fragile native-window automation.

What must not happen is another authority split. If `--web` were implemented by attaching directly to terminal-1, or by creating a second PTY, or by creating a second frontend-owned terminal state machine, it would violate the same platform law that the corrective native change is now converging on. The Web host must consume terminal-2 through protocol 1; it must not replace either terminal-1 shell truth or terminal-2 app-surface truth.

This change therefore adds a app host mode, not a second shell architecture.

## What Changes

- Add `agenter shell --web[=PORT]` as an official `cli-shell` host mode that serves a browser-facing shell surface for the same attached backend terminal. **BREAKING**
- Define the Web host mode as a pure app host over terminal-2, protocol-1 transport, and `web-terminal-view` rather than as a second PTY or second terminal authority. **BREAKING**
- Require the browser-facing shell page to render only the shell projection surface with no extra HTML chrome, panels, or app-local debug scaffolding by default. **BREAKING**
- Require the Web host to bind keyboard, pointer, wheel, clipboard, and resize interactions back through the shared terminal transport and backend viewport-mutation contract. **BREAKING**
- Require the Web host to use a DOM-accessible terminal renderer path so browser accessibility and DOM-driven acceptance can observe the real terminal surface. **BREAKING**
- Require launcher auto-start paths for `agenter shell --web` to discover and reuse a healthy daemon authority for the same runtime root before starting another local daemon. **BREAKING**
- Define `Bun.Terminal` or another local PTY harness as optional test or demonstration infrastructure only; it MUST NOT replace the backend terminal as app truth for official `cli-shell --web` hosting. **BREAKING**
- Add app and acceptance requirements proving that native and Web hosts can observe the same visible input and shared viewport truth for the same terminal-2 surface. **BREAKING**

## Capabilities

### New Capabilities

- `cli-shell-web-host`: serve `cli-shell` through a browser-hosted shell surface backed by `web-terminal-view`

### Modified Capabilities

- `cli-shell-app`: add an official Web host mode while preserving one app over terminal-2 as the final app-terminal truth
- `terminal-view-component`: define `web-terminal-view` as the official browser-facing protocol-1 projection for terminal-2
- `runtime-terminal-contract`: require Web-host resize and interaction flows to stay projection-only against terminal-2 unless geometry authority changes explicitly
- `app-command-launcher`: require launcher-owned daemon discovery/reuse for default `cli-shell --web` startup

## Impact

- `openspec/specs/cli-shell-app/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `packages/cli-shell/src/*`
- `packages/terminal-view/src/*`
- `packages/webui/src/**/*` or a new minimal Web host package

## Desired End State

At the end of this change, the target effect is:

- `bun agenter shell --web` starts the same `cli-shell` app in a browser-facing host mode and prints an explicit local URL
- the opened browser page renders only terminal-2 through `web-terminal-view`
- the Web page uses a DOM-accessible terminal renderer path rather than a canvas-only shell surface
- keyboard input, pointer interaction, wheel scrolling, clipboard input, and resize all route through the existing backend-authoritative terminal contracts
- the Web host does not create a second PTY, second scrollback law, second cursor law, or second viewport law for terminal-2
- the default launcher path for `bun agenter shell --web` reuses one healthy daemon authority for the active runtime root instead of colliding with another local writer on a fixed port
- one native host and one Web host, or multiple Web hosts, can observe the same visible input and shared viewport truth for terminal-2 when attached concurrently
- browser-driven acceptance can validate the real shell surface, including accessibility and DOM-observable interaction, without relying on native window automation
