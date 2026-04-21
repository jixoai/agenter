## Why

The runtime tool surface still treats the avatar root workspace as the only first-class shell primitive. That leaves three coupled problems:

- direct model tools still expose `root_workspace_list` / `root_workspace_bash`
- mounted project workspaces do not have stable AI-facing identity or alias metadata
- the WebUI and tool-trace layer still render only command text instead of which workspace the command ran in

At the same time, the current root shell quietly owns multiple responsibilities at once: runtime-local system CLI, root filesystem authority, mounted workspace overlay, and workspace discovery. That makes multi-workspace work feel available, but the law is still root-only underneath.

The user wants a cleaner split for the current stage:

- `workspace_list` should expose mounted workspaces as real runtime-held resources with `{ id, cwd, alias }`
- `workspace_bash({ workspaceId, ... })` should execute inside one isolated workspace shell
- root-only system control should stay explicit rather than being smuggled into every workspace shell

The user also explicitly rejected the premature design where every mounted workspace automatically receives the same runtime-local system CLI and secret-bearing control surface. That future direction should be tracked separately, not forced into this refactor.

## What Changes

- **BREAKING** Replace the direct model tools `root_workspace_list` / `root_workspace_bash` with `workspace_list`, `root_bash`, and `workspace_bash`.
- Add runtime-mount-level workspace metadata so each mounted workspace has a stable runtime-local numeric id, a mutable alias, and a default exec cwd.
- Keep root-only system CLI and credential-bearing control inside `root_bash`; `workspace_bash` remains a pure workspace shell without root control-plane injection.
- Extend the runtime `workspace` CLI/API namespace with alias management so root control can rename mounted workspaces without adding more direct model tools.
- Update tool traces, heartbeat rendering, and runtime projections so executed commands preserve workspace alias and id snapshots instead of only raw command strings.
- Remove legacy `root_workspace_*` references from active runtime code, guidance, specs, tests, and generated artifacts.
- Record the future “mounted workspace systems create AttentionContext from files and settings” paradigm as a separate change instead of mixing it into this implementation.

## Capabilities

### Modified Capabilities
- `workspace-system-capabilities`: mounted workspaces gain runtime-local ids, aliases, and isolated `workspace_bash` execution as the new direct primitive.
- `runtime-skills-cli-surface`: the direct tool surface changes from root-only tools to `workspace_list + root_bash + workspace_bash`, while root-only system CLI remains available only through `root_bash`.
- `runtime-json-tool-descriptor-surface`: the runtime `workspace` namespace gains alias mutation and updated help/examples for the new root shell naming.
- `runtime-skill-progressive-disclosure`: runtime guidance must teach `root_bash` vs `workspace_bash` correctly and stop referencing `root_workspace_*`.

## Impact

- Affected systems: `workspace-system`, `session-runtime`, `app-kernel`, runtime CLI/local API descriptors, runtime skill guidance/catalog generation, client SDK projections, WebUI heartbeat rendering, and request-body/tool-trace tests.
- Affected APIs: direct model tool names and payloads, runtime-local `workspace` CLI/API output, workspace mount persistence, runtime projections, and tool trace payload shape.
- Affected tests/specs: runtime tool/provider tests, workspace-system tests, heartbeat/tests, runtime skill guidance tests, request-body evidence tests, and durable specs describing runtime shell law.
