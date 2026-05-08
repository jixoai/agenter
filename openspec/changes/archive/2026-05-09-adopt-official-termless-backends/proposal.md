## Why

Agenter already renamed the old terminal render law toward `termless-core`, but the current package topology still violates the intended ownership model. Instead of directly adopting the official Termless backend architecture, the repo introduced an Agenter-private `@agenter/termless-xterm-backend` layer that duplicates backend ownership and makes future `ghostty-native` adoption harder, not easier.

We need to correct this now before more consumers, specs, and tests grow around the wrong boundary. The durable law should be: Agenter owns terminal contracts, projection, and adapters; Termless owns backend implementations.

## What Changes

- **BREAKING** Remove Agenter-private backend ownership as a platform law. Agenter MUST stop treating `@agenter/termless-xterm-backend` as the canonical backend layer.
- Adopt the official Termless backend architecture as the durable backend slot, with `xterm` remaining the current default backend through official Termless backend entrypoints.
- Define Agenter-side ownership narrowly:
  - `@agenter/termless-core` owns shared contract, projection, and renderer-facing terminal facts
  - Agenter adapters/bridges MAY translate between Termless backends and Agenter consumers
  - Agenter MUST NOT redefine backend package ownership already provided by Termless
- Preserve the current durable frontend default that `rendererPreference = auto` resolves to `xterm` until a later backend parity change explicitly promotes another backend.
- Add migration and verification requirements so `bun agenter shell`, `terminal-system`, and real browser `terminal-view` continue to work after backend ownership is corrected.

## Capabilities

### New Capabilities

- `termless-backend-adoption`: defines the durable ownership boundary between Agenter terminal layers and official Termless backend packages, including migration away from Agenter-private backend ownership.

### Modified Capabilities

- `runtime-terminal-contract`: runtime-facing terminal truth and launch/projection contracts must consume the corrected Termless backend ownership model instead of an Agenter-private backend layer.
- `terminal-renderer-adapter`: renderer/viewport law must preserve the current `xterm` default while explicitly separating frontend renderer selection from backend ownership.
- `terminal-view-component`: browser terminal view integration must consume the corrected backend/adaptor ownership boundary without fabricating backend identity inside the component contract.

## Impact

- Affected code:
  - `packages/termless-core`
  - `packages/terminal-system`
  - `packages/cli-shell`
  - `packages/terminal-view`
  - any package currently importing `@agenter/termless-xterm-backend`
- Affected dependencies:
  - official Termless backend packages
  - removal, reduction, or restructuring of Agenter-private backend packages
- Affected docs/specs:
  - `packages/terminal-system/SPEC.md`
  - terminal-related OpenSpec capability specs
  - change docs for follow-up backend parity work
- Verification impact:
  - `bun agenter shell`
  - real browser `terminal-view`
  - focused backend/unit/integration tests
