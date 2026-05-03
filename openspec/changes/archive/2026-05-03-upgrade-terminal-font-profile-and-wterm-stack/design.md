## Context

The previous renderer-preference change fixed the first layer of coupling by making `rendererPreference`, `theme`, and `cursor` durable terminal-system truth. This round extends the same law in two directions that the old shape cannot express cleanly enough:

- terminal presentation still lacks a durable `font` profile, so `xterm` and `ghostty-web` keep their own hard-coded font defaults and the UI has no canonical place to edit them
- `wterm` is not another xterm-like widget; the experiment showed that `@wterm/ghostty` only provides a `TerminalCore`, while `@wterm/dom` provides the actual browser host (`WTerm`) with CSS-variable-driven theme/font control and its own input layer

Experiment results that must survive context loss:

- `ghostty-web` remains a good desktop default because it already fits our current `terminal-view` contract and behaves better than xterm under fit-mode scaling and text selection
- xterm exposes a broad font option surface (`fontFamily`, `fontSize`, `fontWeight`, `fontWeightBold`, `lineHeight`, `letterSpacing`, `customGlyphs`, `rescaleOverlappingGlyphs`, `minimumContrastRatio`), so a font law that only carries `family + size` is too weak
- `@wterm/ghostty` does not satisfy the old mental model of “renderer = one widget instance”; it satisfies a higher-level renderer-stack model where one adapter owns both the core and the browser host
- `@wterm/dom` exposes the browser host as `new WTerm(element, { core, onData, onResize, onTitle, autoResize, cursorBlink })`, and theme/font mostly flow through CSS custom properties such as `--term-font-family`, `--term-font-size`, `--term-line-height`, `--term-fg`, and `--term-bg`

This makes the change cross-cutting even if most UI work looks small, because it upgrades:

- terminal durable profile schema
- authorized browser config mutation
- terminal-view renderer adapter semantics
- WebUI titlebar chrome and local configuration behavior
- terminal window geometry truth, because different renderer stacks do not expose identical native content boxes

## Goals / Non-Goals

**Goals:**

- Define one durable terminal `font` profile that is renderer-neutral but strong enough for current xterm, ghostty-web, and wterm adapters.
- Keep `rendererPreference + theme + cursor + font` owned by terminal-system durable config.
- Keep `resolvedRenderer` front-end local and continue treating `auto` as environment policy.
- Formally support a `wterm` renderer stack without introducing renderer-specific host glue into `terminal-view-element` or Svelte feature code.
- Make renderer-measured native content metrics the only geometry truth for terminal-window fit/cover projection once a renderer session is live.
- Replace the titlebar config dropdown with one dialog that lets the operator change `theme`, `font family`, `font size`, and `rendererPreference` through a local draft/apply boundary.
- Add one adapter-owned presentation mutation policy and one renderer-settled ack event so hosts do not guess whether a presentation change was live-applied, rebuilt, or was a no-op.
- Leave short, engineer-facing comments at the resolver and adapter boundaries so the design can be reconstructed after context loss.

**Non-Goals:**

- Do not change the back-end PTY or xterm-headless snapshot pipeline used by terminal-system durable output.
- Do not move presentation ownership back into AI-facing runtime terminal tools.
- Do not build advanced font-management features such as custom uploads, per-actor font policies, or OS font discovery.
- Do not redesign terminal-window fit/cover geometry beyond the titlebar/config integration already required here.
- Do not let renderer-private default chrome, padding, shadows, or background ownership leak into `terminal-window`; renderer stacks remain viewport primitives.

## Decisions

### 1. Add one durable terminal font profile instead of per-renderer font knobs

Decision:

- Extend `TerminalProcessProfile` with a `font` object.
- The durable shape will stay renderer-neutral and carry:
  - `family`
  - `sizePx`
  - `lineHeight`
  - `letterSpacing`
  - `weight`
  - `weightBold`
  - `ligatures`

Rationale:

- `family + size` alone is too weak for xterm and future renderer alignment.
- A shared font object lets the top level stay declarative while adapters still choose how much of that shape they can faithfully map.
- The panel only needs `family + size` for now, but the durable law should already be complete enough that future work does not need another schema break.

Alternatives considered:

- Flat `fontFamily` / `fontSize` fields: rejected because they are too narrow and would force follow-up schema breaks for line height, bold weight, or ligatures.
- Renderer-specific font blobs: rejected because that would leak renderer shape into terminal-system durable truth.

### 2. Keep `resolvedRenderer` local, but formalize adapters as renderer stacks

Decision:

- Keep `rendererPreference` durable and `resolvedRenderer` front-end local.
- Keep `auto -> ghostty-web` for the current desktop host.
- Upgrade the adapter law in docs, comments, and implementation to mean “renderer stack adapter”, even if the public interface can stay compact.

Rationale:

- The real architectural gap is not async loading; `terminal-view` already supports `ensureReady()`.
- The real gap is conceptual: `wterm` must be allowed to hide a multi-part stack (`GhosttyCore.load()` + `new WTerm(...)`) behind the same host-neutral viewport contract.
- This preserves one `terminal-view` host contract while preventing host code from learning about renderer-private DOM, CSS vars, or core/runtime split.

Alternatives considered:

- Add `if (renderer === "wterm")` branches directly inside host code: rejected because that recreates renderer-private coupling.
- Resolve `auto` on the server: rejected because desktop/mobile/touch environment policy belongs to the front end.

### 3. Browser-authenticated terminal config mutation becomes the only presentation write path

Decision:

- Expand the browser-authenticated `globalSetConfig` path to accept presentation fields (`rendererPreference`, `theme`, `cursor`, `font`).
- Keep AI-facing runtime terminal tool mutation surfaces read-only for those fields.

Rationale:

- The user explicitly wants terminalSystem to own these settings without AI participation.
- WebUI needs an operator-facing panel that changes durable truth, not local component state.
- This keeps one clear authority boundary: terminal-system owns truth, WebUI mutates it through authenticated control-plane APIs, and AI can only inspect it.

Alternatives considered:

- Reuse runtime tool descriptors for presentation edits: rejected because it violates the current terminal-system ownership law.
- Keep only local browser state for theme/font/renderer: rejected because it would drift from durable terminal identity.

### 4. Terminal font defaults use one shared resolver with terminal-safe metrics

Decision:

- Add one shared default terminal font resolver inside `@agenter/terminal-view`.
- The default profile will prefer a dense, readable monospace stack with CJK-safe fallback and stable grid metrics.
- Initial defaults:
  - `family`: shared terminal mono stack rooted in `var(--font-mono)` and `ui-monospace`
  - `sizePx`: `13`
  - `lineHeight`: `1.2`
  - `letterSpacing`: `0`
  - `weight`: `400`
  - `weightBold`: `700`
  - `ligatures`: `true`

Rationale:

- Current hard-coded values are scattered and not justified.
- A shared resolver lets xterm/ghostty-web/wterm share one durable font truth while each adapter still maps it differently.
- The values above keep the terminal compact enough for engineering workflows without relying on renderer-private magic numbers in feature code.

Alternatives considered:

- Keep the current `12 / 1.25` split independently per renderer: rejected because it is accidental, not a law.
- Turn font defaults into a UI-only concern: rejected because the renderer stack itself needs the values.

### 5. The titlebar config surface lives in terminal-window chrome as one dialog, not a live dropdown

Decision:

- Add one icon-only config button in the terminal window titlebar inline-end, next to the geometry text.
- Clicking the button opens one dialog with local draft state and explicit `Cancel` / `Apply` actions.
- The dialog payload is the same in fit and cover modes.
- In cover mode the titlebar remains promoted to sticky `window-container` chrome, but the config payload stays identical.

Rationale:

- These controls are terminal-window-local presentation controls, not global toolbar actions or transient popover state.
- Keeping the same payload in fit and cover matches the already-agreed titlebar law.
- A dialog gives enough room for renderer/theme/font growth and prevents accidental durable writes while the operator is still browsing options.

Alternatives considered:

- Put theme/font/renderer controls into page-toolbar: rejected because that leaks terminal-window-local chrome into route-level toolbar chrome.
- Keep the controls in a radio-driven dropdown: rejected because immediate writes make renderer/font changes feel unstable and do not leave room for an apply boundary.

### 6. Presentation mutation is a two-phase protocol, not immediate host-side mutation

Decision:

- `terminal-window` owns only a local draft of presentation settings while the dialog is open.
- Only `Apply` writes `rendererPreference`, `theme`, `cursor`, or `font` through the browser-authenticated terminal-system config mutation path.
- Each renderer stack adapter declares a presentation mutation policy for `theme`, `cursor`, and `font`:
  - `live-apply`
  - `rebuild-session`
- `terminal-view` uses that adapter policy to decide whether the current renderer stack can stay alive or must be rebuilt, even when the resolved renderer name stays the same.
- After the mutation settles, `terminal-view` dispatches one `terminal-view-presentation-ready` event carrying the terminal id, resolved renderer, settle reason, and current screen metrics.
- `terminal-window` clears its local applying state only after the durable write resolves and the matching ready event arrives.
- Any visual acknowledgement for this flow must stay WAAPI-only and use visual properties such as `transform` / `opacity`, never layout-mutating width or height animation.

Rationale:

- The current immediate-write path makes theme/font/renderer changes feel wrong because the host has no draft boundary and no authoritative “renderer is settled” fact.
- `ghostty-web` currently does not support every theme mutation safely after `open()`, so “live-apply everything” is not a defensible platform law.
- The host should not hard-code renderer-specific exceptions; that is adapter-owned capability knowledge.
- A settled ack lets fit/cover chrome stay honest about when the visible terminal has actually caught up to durable truth.

Alternatives considered:

- Let the titlebar continue writing durable truth on every menu click: rejected because it conflates browsing choices with committing a mutation.
- Put renderer-specific `if (resolvedRenderer === "...")` branches into terminal-window: rejected because it leaks adapter-private capability rules into host chrome.
- Clear the host busy state as soon as the server mutation resolves: rejected because durable truth and visible renderer settlement are different facts.

### 7. Renderer-measured geometry is authoritative once the viewport is live

Decision:

- `terminal-view` remains the viewport primitive and SHALL publish renderer-owned native content metrics.
- `terminal-window` SHALL use those native content metrics as the truth for fit/cover projection, body inset calculation, and drag-resize reference metrics once they are available.
- Formula-derived cell metrics remain only a bootstrap fallback before the renderer reports anything.
- Host code SHALL NOT divide renderer-reported metrics by the current projection scale. The renderer reports native content size; fit/cover is a host projection layered on top of that fact.

Rationale:

- `xterm`, `ghostty-web`, and `wterm` do not expose identical native content boxes.
- Treating one fallback cell-size formula as geometry truth causes bottom clipping in xterm and visible content/window misalignment in canvas- and DOM-based renderers.
- Renderer-native metrics already exist in the contract; ignoring them in the host turns the contract into dead data.

Alternatives considered:

- Keep host geometry purely formula-driven and only use renderer metrics for diagnostics: rejected because it cannot explain renderer-native padding, line box, canvas rounding, or host-specific viewport ownership.
- Feed projected size back into native metrics by dividing through scale: rejected because it mixes viewport projection with intrinsic renderer content and creates circular geometry drift.

### 8. Renderer adapters must normalize themselves to viewport primitives

Decision:

- Renderer adapters own removal or neutralization of renderer-default chrome that conflicts with `terminal-window` ownership.
- `wterm` specifically SHALL not leak its default host padding, shadow, radius, or background ownership into the integrated terminal window.
- Default terminal font family SHALL be a renderer-safe literal stack instead of relying on a host CSS variable such as `var(--font-mono)` inside JS option surfaces.
- When a renderer session rebuilds, `terminal-view` SHALL rehydrate the current snapshot even if the snapshot sequence has not advanced, because rebuild creates a fresh local renderer buffer.

Rationale:

- `wterm` ships with default CSS that styles the host like a standalone terminal card; that is incompatible with our shared `terminal-window` shell law.
- CSS variables can be valid in a CSS host style string while still being unreliable inside third-party renderer JS option parsing.
- A fresh renderer session with unchanged snapshot sequence still needs the current terminal contents; sequence guards that are correct for a live session become wrong after rebuild.

Alternatives considered:

- Keep upstream `wterm` host chrome and try to visually mask it with outer wrappers: rejected because it duplicates shell ownership and reintroduces spacing bugs.
- Rely on later transport output instead of rehydrating current snapshot after rebuild: rejected because rebuild may leave the viewport blank until new PTY output arrives.

## Risks / Trade-offs

- [Profile shape expands across five packages] -> Thread `font` through terminal-system first, then app-server/client-sdk, then WebUI and terminal-view in one bounded pass.
- [WTerm CSS contract differs from xterm option contract] -> Keep mapping adapter-local and do not ask host code to set renderer-specific CSS variables.
- [Font defaults may still need tuning after real-device testing] -> Keep the durable shape expressive enough to retune values without another schema break.
- [Storybook DOM tests may miss renderer-specific runtime issues] -> Keep terminal-view unit tests focused on adapter behavior and use Storybook DOM for the titlebar config surface.
- [Renderer swap could accidentally rebuild the PTY or lose input focus] -> Limit rebuild scope to the local renderer stack/session and keep PTY transport/session id untouched.
- [Renderer preference may change while resolved renderer stays the same] -> Dispatch a ready ack for stable/no-op presentation commits so host apply state still terminates deterministically.
- [Renderer metrics may arrive after first paint] -> Keep a bootstrap fallback path, but switch host geometry to measured native content as soon as the renderer reports it.
- [Renderer default CSS may own card-like chrome] -> Strip that ownership inside adapters so the integrated terminal window remains the only shell authority.
- [Font changes can rebuild a renderer while snapshot seq stays unchanged] -> Force rehydrate on rebuild and test that rebuilt sessions are never blank.
- [Renderer host box can differ from terminal content box] -> Treat adapter-reported native content metrics as the only geometry truth, and make adapters measure renderer-owned screen/grid surfaces instead of scroll hosts or projected wrappers.

## Migration Plan

1. Add OpenSpec delta specs and tasks for the new durable font/profile and renderer-stack law.
2. Extend terminal-system types, defaults, clone/merge logic, and authorized config mutation with `font`.
3. Thread `font` through app-server projections and client-sdk runtime store normalization.
4. Add shared terminal font resolver plus adapter-local mapping in `@agenter/terminal-view`.
5. Add `wterm` renderer stack support using `@wterm/dom` + `@wterm/ghostty`.
6. Update `terminal-view-host` and terminal route/window chrome to pass the new font profile.
7. Add the titlebar config panel and wire it to browser-authenticated durable config mutation.
8. Update durable specs (`SPEC.md`, package `SPEC.md`) and leave rationale comments at resolver/adapter boundaries.
9. Run targeted typecheck/test coverage and Storybook DOM verification.
10. Replace immediate titlebar config mutation with dialog draft/apply flow, adapter-owned presentation policy, and renderer-settled ready ack.
11. Switch terminal-window projection to renderer-measured native content metrics and stop treating formula-derived cell sizes as the final geometry truth.
12. Normalize `wterm` to viewport-only host chrome, make rebuild hydration unconditional for fresh sessions, and add regression tests for rebuilt-session visibility plus metrics correctness.
13. Re-verify native metrics against real `xterm`, `ghostty-web`, and `wterm` runtime surfaces; if a renderer host box differs from its content box, encode the content-surface rule inside the adapter instead of compensating in host code.

Rollback:

- This is a local breaking schema/code change, so rollback is code-level rather than data-migration-level. Keep the `font` threading and the `wterm` adapter isolated enough that they can be reverted without touching terminal-window geometry law.

Recovery after context loss:

- Read `proposal.md` for objective.
- Read this `design.md` for the reason `wterm` is a stack and not a widget.
- Resume from `tasks.md` in order.
- If code already exists, check that the resolver and adapter comments still explain:
  - why desktop `auto` currently resolves to `ghostty-web`
  - why `wterm` is implemented as `core + dom host`
  - why `font` is durable terminal-system truth instead of renderer-local defaults
  - why renderer-native content metrics must come from renderer-owned screen/grid surfaces, not from projected host boxes

## Real Verification Addendum

Route-level verification after the first implementation uncovered one remaining platform gap:

- `wterm` host geometry is not the same thing as `wterm` terminal-content geometry.
- In the integrated terminal window, `.wterm` is the scroll owner while `.term-grid` and its active `.term-row` rows describe the actual terminal content box.
- Therefore `host.clientWidth/clientHeight` is not a reliable substitute for native screen metrics once scrollback, host locking, or promoted cover chrome are involved.

Observed evidence that must survive context loss:

- On the Storybook terminal route, `wterm` reported host-sized metrics such as `800 x 480` while the public terminal screen surface was `800 x 408`.
- After changing `wterm` font size, the mismatch persisted and could even invert, proving that host-box measurement and terminal-content measurement are different facts.
- `ghostty-web` upstream does support runtime `fontSize` / `fontFamily` changes and triggers its own font remeasure path, so "font update looks wrong" is more likely a settle/measurement issue than a missing engine capability.

Additional law tightened by this evidence:

- `terminal-view` must never reverse-project renderer metrics by dividing them through fit scale. Native metrics are intrinsic content facts; projection is a host concern layered on top.
- Each renderer adapter must publish the most faithful native content metrics it can observe from renderer-owned surfaces.
- `wterm` specifically must derive native metrics from its active terminal content surface, not from the outer scroll host.

## Open Questions

- Do we want to expose advanced font fields such as `lineHeight` and `ligatures` in the first UI panel, or keep the first panel limited to `family + size` while the rest stay durable defaults?
- Should a future mobile/touch heuristic for `auto -> wterm` live inside terminal-view's resolver or in a thinner WebUI environment policy layer passed into it?
