## Why

The terminal control plane already has actor-scoped focus primitives, but the current product still presents terminal focus like a single global toolbar toggle. That leaks the wrong mental model into WebUI and risks coupling LoopBus attention injection to UI selection state instead of to the terminal-system's actor-owned focus truth.

## What Changes

- Make terminal focus an explicit per-actor collaboration state from backend projection through WebUI affordances.
- Remove the misleading terminal-global focus action from the workbench toolbar and move focus or unfocus controls into per-user terminal seats.
- Bind AvatarSession terminal attention ingestion only to the focused terminal set owned by that AvatarSession's terminal actor.
- Separate terminal viewport selection from terminal-system focus so the user can inspect a terminal without mutating collaboration focus state.
- **BREAKING** terminal bootstrap and terminal admin flows stop assuming one shared global focus owner.

## Capabilities

### New Capabilities
- `terminal-seat-focus`: actor-scoped terminal focus projection, mutations, and runtime consumption rules.

### Modified Capabilities
- `terminal-collaboration-access-control`: focus operations must be modeled as actor-scoped state, not one shared toolbar mutation.
- `runtime-terminal-contract`: runtime projections must expose the current session actor's focused terminal set without collapsing terminal-system truth into one global flag.
- `attention-source-plugins`: terminal source adapters must resolve focused terminals from the current session actor's terminal focus state.
- `webui-terminal-surface`: terminal users panels and workbench chrome must distinguish browsing selection from actor focus control.

## Impact

- Affected code: `packages/terminal-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected UX: Terminals page, terminal users panel, terminal activity tools, AvatarSession terminal ingestion.
- Cross-change dependency: this change consumes auth-backed actor identity from `auth-superadmin-identity-vnext` but keeps terminal truth inside terminal-system.
