## Context

Agenter already split shared terminal projection into `@agenter/termless-core`, but the current package graph still installs an Agenter-private backend authority at `@agenter/termless-xterm-backend`. That is the wrong long-term law.

The official Termless model is already `@termless/core` plus official backend packages such as `@termless/xtermjs` and `@termless/ghostty-native`. Agenter does not need to re-own that layer. Agenter's durable responsibility is narrower: terminal launch/runtime contracts, projection, transport, renderer adapters, and product-facing bridges.

Current code paths that expose the wrong ownership boundary include:

- `packages/terminal-system/src/xterm-bridge.ts`
- `packages/cli-shell/src/tui/live-terminal-mirror.ts`
- `packages/termless-xterm-backend/*`

This change is intentionally spec-first. The goal is to correct the platform law before implementation grows around the wrong package boundary.

## Goals / Non-Goals

**Goals:**

- Re-establish official Termless backends as the only backend ownership layer.
- Keep Agenter-side ownership limited to contract, projection, transport, and renderer/consumer adapters.
- Preserve current observable behavior while correcting architecture:
  - `bun agenter shell` remains usable
  - current default backend stays xterm
  - current desktop renderer default stays xterm
  - `terminal-view` attach/reconnect semantics remain stable
- Make future official backends such as `@termless/ghostty-native` plug into the same slot without another Agenter-owned backend package.

**Non-Goals:**

- Promoting `ghostty-native` to the default backend in this change.
- Changing the browser renderer default away from xterm in this change.
- Rewriting terminal runtime contracts beyond the backend/renderer ownership boundary.
- Inventing a second Agenter-private backend registry that duplicates Termless's package and backend model.

## Decisions

### 1. Official Termless packages own backend identity

Agenter SHALL treat official Termless packages as the backend ownership layer:

- `@termless/core`
- `@termless/xtermjs`
- future official packages such as `@termless/ghostty-native`

`@agenter/termless-xterm-backend` is therefore not a durable architecture boundary. It duplicates ownership that Termless already provides and makes future backend adoption look like an Agenter concern instead of a Termless concern.

Alternative considered:

- Keep `@agenter/termless-xterm-backend` as the canonical backend package.
  - Rejected because it creates a second source of truth for backend identity, capabilities, and migration.

### 2. Agenter keeps adapter and projection ownership only

Agenter still needs local code for:

- transport/session glue
- structured render projection
- consumer-local readable/writable bridge shapes
- runtime-facing launch/config projection
- browser renderer adapters

That code SHALL consume official backend instances or official backend entrypoints. It SHALL NOT present itself as the canonical backend package.

Alternative considered:

- Remove all Agenter-local terminal bridge code and consume raw Termless APIs directly everywhere.
  - Rejected because Agenter still has legitimate local contracts such as runtime projection and product-facing terminal mirrors.

### 3. Backend selection and browser renderer selection stay orthogonal

Backend identity and browser renderer identity solve different problems:

- backend: PTY-fed terminal model implementation used by runtime/test/bridge code
- renderer: browser viewport implementation used by `terminal-view`

This refactor keeps them explicitly separate. Current desktop WebUI still resolves `rendererPreference = auto` to `xterm`, but that renderer fact must not be treated as ownership over the backend slot.

Alternative considered:

- Collapse backend and renderer into one `xterm` concept.
  - Rejected because it blocks future combinations and makes browser rendering leak into runtime/backend contracts.

### 4. Migration targets production imports first, then package deletion

Implementation should first move production imports away from `@agenter/termless-xterm-backend` and onto official Termless backend entrypoints plus local bridges. After the dependency graph is clean, the obsolete workspace package can be removed or reduced to an internal migration stub during the same implementation sequence.

The durable end state is: no production package treats an Agenter-private backend package as terminal backend authority.

Alternative considered:

- Keep the package indefinitely but document that it is "just a shim".
  - Rejected because the package name and dependency graph would continue teaching the wrong law.

## Risks / Trade-offs

- **[Risk] Official backend APIs will not match current `XtermBridge` expectations exactly**  
  **Mitigation:** keep bridge code adapter-local and update focused tests around readable/writable behavior instead of leaking backend details upward.

- **[Risk] The refactor may preserve behavior but still miss one hidden import path**  
  **Mitigation:** add a dependency-boundary audit task and boundary tests that fail on production imports of `@agenter/termless-xterm-backend`.

- **[Risk] Future `ghostty-native` work could be smuggled into this change**  
  **Mitigation:** keep this change scoped to ownership correction plus xterm parity preservation; backend promotion remains a separate change with its own acceptance.

- **[Risk] Browser renderer discussions could derail backend refactor work**  
  **Mitigation:** keep renderer law limited to one rule here: browser renderer selection remains orthogonal to backend ownership.

## Migration Plan

1. Land this OpenSpec change as the new platform law.
2. Audit all production imports, tests, and docs that reference `@agenter/termless-xterm-backend`.
3. Rewire `terminal-system`, `cli-shell`, and any shared bridge code to consume official `@termless/xtermjs` entrypoints.
4. Update runtime/config/view contracts so backend launch truth and browser renderer facts stay separate.
5. Re-run focused verification:
   - terminal-system tests
   - cli-shell tests
   - terminal-view tests
   - `bun agenter shell`
   - real browser `terminal-view` attach/reconnect
6. Delete or finish collapsing the obsolete Agenter-private backend package before the change is considered complete.

Rollback:

- Spec rollback is a normal revert of the spec commit.
- Implementation rollback can use the existing architecture anchors already in history, but only as rollback points, not as the desired end state.

## Open Questions

- Should any remaining Agenter-local bridge helper live inside each consuming package, or does one neutral adapter package still provide enough value without re-creating backend ownership confusion?
- Should `@agenter/termless-core` eventually be renamed again to emphasize projection/adapters over backend identity, or is the current name acceptable once backend ownership is corrected?
