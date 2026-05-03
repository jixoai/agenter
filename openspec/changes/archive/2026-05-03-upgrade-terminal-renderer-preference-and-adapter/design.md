## Context

Current terminal rendering is nominally configurable but still physically centered on `xterm`:

- terminal-system profile and projection types only allow `"xterm"`
- runtime terminal config descriptors expose renderer mutation to AI/tooling
- `@agenter/terminal-view` directly imports xterm packages, xterm css, xterm DOM class names, xterm-only `onBinary` / `registerCharacterJoiner`, and xterm private `_core._renderService.dimensions`
- WebUI and e2e tests reach into `.xterm-helper-textarea` and `.xterm-screen`
- terminal-window/body backgrounds are partially feature-local instead of theme-owned

At the same time, product goals have changed:

- desktop WebUI should default to `ghostty-web`
- `ghostty-web` is preferred for current fit/cover work because scale does not break selection the same way xterm does
- future mobile/touch-first surfaces may prefer `wterm`
- renderer preference plus declarative theme/cursor identity should be terminal-system durable truth, but renderer resolution should still belong to the front-end environment rather than to AI or back-end lifecycle law

The user-supplied rationale that must survive context loss is:

- `ghostty-web` should be the current desktop default because its rendering architecture is stronger than xterm for this product's fit/cover projection law.
- In current xterm-based fit mode, host scaling can leave text selection visibly offset because xterm relies on a stack of DOM/layout hacks that do not remain stable under scaled projection.
- `ghostty-web` renders through canvas and owns selection behavior itself, so host-side scale does not inherently break selection in the same way.
- `wterm` is worth preserving as a future renderer target because it is explicitly optimized for the web/mobile environment and accessibility, even if it is not implemented in this round.
- `auto` must exist because renderer choice is environment policy, not one fixed durable engine string. Today that policy is desktop -> `ghostty-web`; later mobile/touch-first may resolve to `wterm`.
- The theme law should stay declarative at the top: the durable profile chooses a `theme` name and `cursor` style, then each renderer adapter maps those declarations into the concrete configuration depth it can support.

This is a cross-cutting change because it alters:

- terminal durable profile schema
- terminal projection shape
- runtime tool descriptor authority
- shared WebComponent contract
- client normalization
- WebUI renderer selection and theme application

## Goals / Non-Goals

**Goals:**
- Define one durable terminal renderer preference contract that is renderer-neutral and future-proof for `ghostty-web`, `wterm`, and `xterm`.
- Keep `rendererPreference`, `theme`, and `cursor` as terminal-system owned durable profile facts.
- Let front-end hosts resolve `rendererPreference=auto` into a concrete renderer based on environment.
- Establish one `TerminalRendererAdapter` contract so host code stops depending on renderer-private DOM, metrics, and input surfaces.
- Default current desktop WebUI to `auto -> ghostty-web`.
- Introduce resolved theme projection so terminal-window body and terminal viewport consume one shared background law.
- Remove AI-facing authority to mutate renderer/theme fields via runtime terminal config descriptors.
- Write the change so it is self-recoverable after context loss.

**Non-Goals:**
- Do not implement `wterm` fully in this round.
- Do not redesign terminal-window fit/cover geometry itself beyond the renderer/theme integration points already needed by this change.
- Do not replace PTY, transport protocol, or back-end xterm/headless rendering used for durable snapshot generation.
- Do not promise every xterm option is supported identically by every renderer.
- Do not build a renderer marketplace or plugin loader in this round.

## Decisions

### 1. Split durable preference from concrete resolved renderer

Decision:
- Durable terminal profile uses `rendererPreference`, not one concrete `rendererEngine`.
- Front-end runtime computes `resolvedRenderer` and optional `rendererReason`.
- `resolvedRenderer` remains a front-end fact and does not become server-owned authoritative truth in this round.

Rationale:
- `auto` is not a concrete renderer and should not be encoded as if it were.
- The user explicitly wants front-end owned resolution, not AI-owned mutation.
- This keeps terminal-system durable truth stable while still allowing device-specific front-end choices and different concrete renderer choices on different clients for the same terminal.

Alternatives considered:
- Keep `rendererEngine` and allow `"auto"` as just another engine string: rejected because it confuses policy with implementation.
- Resolve the renderer on the server: rejected because desktop/mobile/web environment facts belong to the front-end host.

Implementation note for future code comments:
- When the resolver lands in code, leave a succinct comment explaining that `auto` exists because renderer choice is front-end environment policy, and that the current desktop preference for `ghostty-web` is motivated by scale-safe selection under fit/cover projection.

### 2. Add a shared adapter contract inside `@agenter/terminal-view`

Decision:
- `@agenter/terminal-view` will own a `TerminalRendererAdapter` contract and a renderer resolver.
- Initial concrete adapters:
  - `xterm` adapter
  - `ghostty-web` adapter

Rationale:
- The viewport primitive is the correct containment boundary for renderer-private DOM, hidden textarea mechanics, fit addons, metric collection, scroll semantics, and theme translation.
- This prevents WebUI, tests, and hosts from hard-coding `.xterm-*` internals again.
- It also preserves the specific renderer rationale: xterm, ghostty-web, and future wterm differ in DOM shape, focus proxy mechanics, selection model, and metrics, so those differences must terminate inside the adapter rather than leaking into host code.

Alternatives considered:
- Put `if (renderer === ...)` branches directly in `terminal-view-element.ts`: rejected because it recreates host-level coupling and blocks future `wterm`.
- Create renderer-specific WebComponents: rejected because that would fork host contracts and duplicate viewport law.

### 3. Keep terminal-system durable truth renderer-neutral and declarative for theme/cursor

Decision:
- terminal-system profile stores durable renderer preference plus declarative `theme` and `cursor` values only.
- terminal-system projection exposes those durable facts, but it does not own environment resolution logic and does not publish `resolvedRenderer` as authoritative back-end truth in this round.

Rationale:
- terminal-system should own profile truth, not client environment heuristics.
- This matches the user's rule that theme and renderer belong to terminalSystem, but AI does not manage them.
- Keeping theme/cursor declarative leaves adapters room to tolerate capability mismatches and renderer-specific configuration depth.

Alternatives considered:
- Let runtime terminal config descriptors keep mutating renderer/theme: rejected because the user explicitly said these do not belong to AI cognition and mutation.

### 4. Theme and cursor are first-class declarative profile surfaces, not CSS afterthoughts

Decision:
- Add durable declarative `theme` names (for example `default-dark`, `default-light`, `monokai`) plus declarative cursor styles.
- Add a shared theme resolver used by `terminal-view` and terminal host surfaces.
- `terminal-window-body` and viewport screen background use `theme.background`.

Rationale:
- The current feature-local gradient background violates the terminal-system ownership law.
- Future renderer additions must not each invent their own background law.
- The declarative `theme + cursor` surface gives each adapter room to map into whatever concrete option depth that renderer can actually support, instead of forcing one rigid renderer-agnostic option bag.

Alternatives considered:
- Keep terminal-window background independent from terminal theme: rejected because it guarantees visual drift and undermines dynamic theme switching.
- Standardize every deep color/cursor field at the top level immediately: rejected because that would over-constrain adapters before real multi-renderer experience exists.

### 5. Treat xterm-only behavior as adapter-local compatibility, not host contract

Decision:
- xterm-only hooks such as `registerCharacterJoiner`, `onBinary`, helper textarea selectors, or private `_core` metric reads are adapter-local implementation details.
- The shared host only consumes public adapter facts such as:
  - `screenMetrics`
  - input bytes callback
  - title changes
  - resize/focus capability
  - theme application

Rationale:
- The experiment already proved `ghostty-web` does not expose `.xterm-*` DOM.
- The host should not depend on one renderer's hidden geometry model.

Alternatives considered:
- Preserve `.xterm-*` selectors and add fallback selectors for `ghostty-web`: rejected because that scales linearly with every renderer and still keeps host logic renderer-aware.

### 6. Preserve explicit failure over silent renderer substitution for non-auto preferences

Decision:
- `auto` may resolve to different renderers by environment.
- Explicit `ghostty-web`, `wterm`, or `xterm` preferences MUST NOT silently resolve to another renderer if the requested adapter is unavailable.

Rationale:
- `auto` is the legal place for policy and fallback.
- Explicit preferences are user-visible durable intent and should fail loudly if unsupported.

Alternatives considered:
- Always fallback to xterm when another renderer is unavailable: rejected because it would hide configuration truth and make debugging impossible.

## Comment Guidance

The following rationale MUST be duplicated in succinct code comments at the implementation boundaries where it matters:

- In the renderer resolver: why `auto` exists and why current desktop resolves to `ghostty-web`
- In the adapter contract: why renderer-private DOM/selection/metrics behavior must terminate inside adapters
- In theme/cursor resolver code: why the top-level surface stays declarative and why adapters are allowed to do renderer-specific mapping/tolerance
- In any future `wterm` placeholder or TODO: that `wterm` is being preserved for web/mobile accessibility and environment-specific optimization, not as a random extra engine

These comments should be short and engineer-facing, but they must preserve the decision basis so the next engineer does not have to rediscover it from old conversation history.

## Risks / Trade-offs

- [Cross-package schema churn] → Introduce the new fields once in terminal-system types first, then thread them forward through projections and store normalization before swapping renderer implementations.
- [Adapter contract under-specified] → Define minimal public adapter capabilities in specs and code comments before writing both concrete adapters.
- [Tests still depend on xterm DOM] → Update test harnesses to consume public viewport facts or adapter-owned test surfaces, not `.xterm-*` selectors.
- [ghostty-web option mismatch with xterm] → Translate options per adapter; do not force one canonical option bag to equal every renderer-specific implementation detail.
- [Future wterm work stalls because contract is still desktop-biased] → Keep adapter API oriented around viewport primitives, not canvas-specific details.
- [Theme projection leaks product chrome concerns into viewport package] → Keep resolved theme tokens minimal and terminal-centric (`background`, `foreground`, `cursor`, selection/scrollbar tokens if needed).
- [Breaking migration may temporarily destabilize tests] → Accept the breaking update explicitly, update all affected projections/tests in one bounded sequence, and avoid half-compatible dual-field logic that would linger.

## Migration Plan

1. Add the OpenSpec contract updates first so the new law is explicit.
2. Upgrade terminal-system profile/projection types directly:
   - replace `rendererEngine` with `rendererPreference`
   - add declarative `theme` and `cursor`
   - do not preserve long-term compatibility aliases as an architectural requirement
3. Remove renderer/theme mutation from AI-facing runtime terminal config descriptors.
4. Introduce `@agenter/terminal-view` renderer resolver + adapter contract.
5. Move current xterm implementation behind the xterm adapter.
6. Add a `ghostty-web` adapter and set current desktop WebUI `auto` resolution to `ghostty-web`.
7. Replace host/test xterm-private selectors and private metric reads with adapter/public viewport facts.
8. Add shared theme resolver and wire terminal-window/viewport background to `theme.background`.
9. Run unit, DOM, and e2e verification across desktop plus any existing mobile viewport coverage.
10. After stable migration, remove any leftover legacy `rendererEngine` usage from durable code paths entirely.

Rollback strategy:
- Because this is a local repo change rather than a deployed schema migration, rollback is code-level: keep the change isolated so the renderer resolver and adapter layer can be reverted independently from terminal-window geometry work if needed.

Recovery strategy after context loss:
- Read `proposal.md` to understand the user goal.
- Read this `design.md` to recover the layer boundaries.
- Read delta specs in this change to recover exact contracts.
- Resume from `tasks.md` in order. The correct first implementation task is the terminal-system durable field upgrade, not the WebUI renderer swap.
- If code already exists, verify that the resolver/adapter modules still contain the rationale comments described above; if they do not, restore them before making further renderer policy decisions.

## Open Questions

- How much of the resolved theme token set belongs in the shared viewport package versus WebUI host chrome?
- When `wterm` lands, should the mobile/touch heuristic live in `@agenter/terminal-view` or a thinner WebUI environment resolver passed into it?
