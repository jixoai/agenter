## Why

The current host-input behavior was moved into `@agenter/termless-core`, but that makes `core` own optional input policy that can conflict with a future richer backend such as a wezterm backend that already implements its own keyboard, pointer, selection, or clipboard rules. We need a smaller, opt-in package that lets products assemble backend utilities explicitly without turning them into core terminal law.

Original user intent for this change: `core` placement is architecturally risky because a future complete backend may ship its own input logic; create `termless-backend-utils` to modularly host these behaviors so a backend such as `wezterm-backend` can reuse only the utilities it needs.

## What Changes

- Add `packages/termless-backend-utils` as `@agenter/termless-backend-utils`.
- Move terminal host input controller and host input event types out of `@agenter/termless-core`.
- Keep `@agenter/termless-core` as the terminal contract/backend-adapter layer only; it SHALL expose interaction contracts, not optional host input policy.
- Make host input behavior explicitly composable through feature switches so consumers can opt into keyboard encoding, word navigation, keyboard selection, drag selection, semantic double/triple click selection, and selection clearing independently.
- Update `shell-next` to depend on and explicitly compose `@agenter/termless-backend-utils`.
- **BREAKING**: `@agenter/termless-core` no longer exports `createTerminalHostInputController` or the `TerminalHost*` host input types.

## Capabilities

### New Capabilities

- `termless-backend-utils`: Optional utility package for backend-adjacent behaviors that can be assembled by products or partial backends without becoming backend authority.

### Modified Capabilities

- `termless-backend-adoption`: Clarify that Agenter-local backend utility packages are allowed only as opt-in adapters/utilities and must not redefine backend identity or move optional input policy into core.

## Impact

- New package: `packages/termless-backend-utils`.
- Affected packages: `packages/termless-core`, `extensions/shell-next`.
- Affected APIs: host input controller imports move from `@agenter/termless-core` to `@agenter/termless-backend-utils`.
- Verification: BDD tests for utility package composition switches plus shell-next typecheck/test coverage.
