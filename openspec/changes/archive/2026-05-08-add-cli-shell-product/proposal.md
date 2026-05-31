## Why

Agenter needs a developer-facing app that lets ordinary users start from the terminal without learning the superadmin WebUI. The new `agenter shell` surface should act like an SSH-style attachment to an Agenter-backed shell app while preserving backend room, terminal, and AvatarRuntime truth as the only authorities.

## What Changes

- Add a app command launcher law to the core `agenter` CLI: unknown app commands such as `shell` resolve to controlled npm packages such as `@agenter/cli-shell`.
- Add a app runtime law: core packages expose programmable app-extension interfaces, while `@agenter/cli-shell` remains an external extension module that consumes those interfaces.
- Require external app packages to consume the extension runtime through daemon/client-sdk style contracts rather than importing monorepo core internals, even when local workspace resolution is used for tests.
- Add local development resolution for app packages so monorepo tests can launch `packages/cli-shell` before falling back to installed or remote npm execution.
- Add the `@agenter/cli-shell` app package as the first ordinary-user terminal app.
- Define `agenter shell` as a dedicated terminal-assistant summon plus a stable app terminal attachment: cli-shell defaults to `@shell-assistant`, while explicit mentions such as `@default` remain supported overrides.
- Define the default `@shell-assistant` initialization law: it gets an `AGENTER.mdx` prompt source focused on pair programming, user understanding, and self-evolution, plus dedicated memory files for long-lived user fit and current hosting objectives. Self-evolution is orthogonal to managed mode.
- Use the current app attention programmable surface for self-evolution through minimal attention-cli compatible `commit/query/settle` operations; richer `watch/schedule` loop primitives are deferred to the follow-up change `extend-attention-cli-self-evolution-runtime`.
- Add real AI evaluation requirements for shell-assistant self-evolution: use the existing semantic judge tooling and long-running scenario scripts to score whether learned memory/prompt evolution fits the user and preserves orthogonal architecture, retry below-threshold evaluations, and treat repeated low scores as prompt or implementation defects.
- Add an anti-overfit governance rule: prompt changes must improve the general shell-assistant law and must not be tuned only to pass a narrow AI evaluation fixture while violating this change's orthogonal design constraints.
- Add `.chat/add-cli-shell-app/` as the required development log location for contradictions, idealized-assumption failures, objective pain points, and app/runtime tensions discovered during implementation.
- Define `--session=<name>` as a cli-shell app terminal naming rule, defaulting to `shell-1`, not as an AvatarRuntime session identity.
- Make cli-shell use superadmin auto-login by default while keeping backend global room, terminal, and AvatarRuntime systems as the single source of truth.
- Define cli-shell managed/takeover as a hosting AttentionItem plus bounded delegation over terminal and room resources, not as local UI state or a core cli-shell special case. Enabling managed mode commits the fixed score key `scores: {"hosting": 1000}` and, by default, creates a write-capable terminal delegation lease; disabling managed mode MUST commit `hosting: 0`; the Avatar may also reduce `hosting` to `0` when it decides the hosting obligation is actually settled.
- Define a shell-terminal as the user's real terminal process and keep each shell-terminal attached to exactly one backend terminal.
- Keep the app's default visible intrusion bottom-only and one-line: the normal terminal space remains primary, while Agenter exposes a one-row toolbar with status icon, current heartbeat, and action buttons.
- Provide an explicit Agenter dialogue panel when opened, with toolbar, Markdown-rendered message list, and focused input box.
- Treat the TUI as a strict terminal character grid: app chrome is drawn with cells, split lines, minimal floating borders, gutter columns, scrollbar columns, and background cell ranges rather than Web-style pixel cards.
- Render compact dialogue time metadata and insert centered date divider rows when the visible conversation crosses a local date boundary.
- Add a v8 app effect reference set under this change: PNG design references plus paired SVG and TXT terminal-grid auxiliaries for iterative app feedback.

## Capabilities

### New Capabilities

- `app-runtime`: Core Agenter exposes generic programmable extension contracts for app launch context, resource binding, assistant initialization, attention ingress, minimal attention-cli compatible self-evolution operations, and delegation leases without importing or branching on app implementation packages.
- `app-command-launcher`: Core `agenter` CLI can discover and launch controlled app command packages from local workspace, installed packages, or npm fallback.
- `cli-shell-app`: The `@agenter/cli-shell` package provides an SSH-like TUI app that attaches one user shell-terminal to one named backend terminal, a room, and an AvatarRuntime without owning backend truth.
- `shell-assistant-avatar`: Cli-shell initializes and maintains the default terminal assistant Avatar, its `AGENTER.mdx` prompt source, app-linked memory pack, and hosting AttentionItem semantics.

### Modified Capabilities

- `avatar-runtime-topology`: App-level session names such as `--session=2` must attach resources to the existing AvatarRuntime for the selected Avatar instead of creating another runtime identity.

## Impact

- `packages/cli/src/run-cli.ts`
- `packages/cli/test/cli.e2e.test.ts`
- `packages/cli-shell/`
- `packages/client-sdk/src/*`
- `packages/app-server/src/*` app extension / runtime-local API descriptors
- `packages/app-server/src/semantic-judge.ts` and real semantic judge test support for AI-evaluated shell-assistant self-evolution
- `packages/app-server/test-support/real-model-cache.ts` for cached long-running real AI validation
- `packages/avatar/src/*` shell-assistant ensure and prompt source resolution
- `packages/i18n-*/prompts/AGENTER.mdx` or generated avatar prompt templates
- `packages/terminal-system/src/*` delegation and write lease tracing
- WorkspaceSystem avatar-private memory roots used by shell-assistant memory roles
- `packages/tui/` or shared OpenTUI primitives reused by cli-shell
- `openspec/specs/app-runtime/spec.md`
- `openspec/specs/avatar-runtime-topology/spec.md`
- `openspec/changes/add-cli-shell-app/assets/`
- `.chat/add-cli-shell-app/` implementation contradiction and pain-point logs
