## Why

The current terminal law keeps stopped or killed terminals in the default live catalog until someone explicitly deletes them. That made sense when the system treated `stop PTY` and `delete terminal` as separate durable outcomes, but it now conflicts with the runtime and AI mental model: dead terminals keep accumulating in `terminal list`, stale instances keep competing with the actually-live shell resource, and daemon cold restart only rewrites SQL fields instead of replaying the real terminal-death consequences.

We need one cleaner law: live terminal instances and terminal history are two projections of the same durable instance table. Once a terminal instance is killed, it must leave the live registry, mute its attention context through the normal attention flow, and remain inspectable only through explicit history surfaces.

## What Changes

- **BREAKING** Rework terminal lifecycle so killed terminals no longer remain in the default live terminal registry.
- **BREAKING** Replace the old `stop preserves durable live identity until delete` default law with `live projection` versus `history projection` over one durable terminal-instance record set.
- Add a unified killed flow that every death path must use: explicit stop/kill, natural PTY exit, and daemon cold-start compensation for stale running rows.
- Require terminal death to drive terminal-owned cleanup plus attention updates, including muting the bound attention context through committed attention facts instead of silent runtime state mutation.
- Add explicit runtime and CLI history-management surfaces so `terminal list` shows live terminals and `terminal history` manages killed/archive/delete flows.
- Clarify terminal-system UI law so dead terminals move out of the main live workbench and into explicit history/archive management instead of remaining selectable as if they were active shells.

## Capabilities

### New Capabilities
- `terminal-instance-history-projection`: Defines one-table live/history/archive projections, unified killed flow, and history management semantics for terminal instances.

### Modified Capabilities
- `terminal-control-plane`: Terminal lifecycle, default listing, and death semantics change from durable stopped-live identity to live/history projections and unified killed flow.
- `runtime-terminal-contract`: Runtime terminal publications and recovery must treat killed terminals as history-only and must replay daemon restart compensation through the same killed flow.
- `attention-context-state`: Terminal death now requires a durable path that moves the associated attention context to `muted` without creating fake active debt.
- `runtime-json-tool-descriptor-surface`: Runtime terminal descriptors must expose `terminal history`, `terminal archive`, and the new lifecycle semantics for stop/delete/history management.
- `runtime-skills-cli-surface`: Built-in terminal skill guidance must teach the new live-versus-history law and stop telling the AI that stopped terminals remain part of the normal live list.
- `terminal-system-surface`: The standalone terminal-system UI must separate live terminals from history/archive management and remove killed terminals from the main live route.

## Impact

- Affected code: `packages/terminal-system`, `packages/app-server`, runtime CLI descriptors, terminal-system UI surfaces, and any cli-shell/app code that currently assumes killed terminals remain in the default live list.
- Affected durable data: terminal catalog/state fields, daemon recovery normalization, attention-context updates tied to terminal death, and history/archive/delete management over terminal output directories.
- Affected AI/runtime behavior: `terminal list` and terminal skill guidance now bias toward truly live terminals only, reducing stale-terminal interference in model reasoning.
