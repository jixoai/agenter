# terminal-renderer-adapter Specification

## Purpose

Define the shared renderer-preference, resolution, and adapter law for terminal viewport implementations.
## Requirements
### Requirement: Terminal viewport rendering SHALL resolve a durable renderer preference through a shared adapter contract

The standalone terminal viewport layer SHALL resolve durable terminal renderer preference through a shared renderer stack adapter contract instead of binding host code to one renderer widget's private DOM, metrics, input surface, or CSS-variable contract. A renderer stack adapter MAY internally compose multiple renderer-specific layers such as a core runtime plus a DOM host.

#### Scenario: Host embeds one terminal viewport without renderer-private stack assumptions
- **WHEN** a host embeds `terminal-view` for a terminal with a durable renderer preference
- **THEN** the viewport resolves that preference through a shared renderer stack adapter contract
- **AND** the host does not need direct knowledge of renderer-private DOM classes, helper textareas, CSS variables, or core/runtime split

#### Scenario: One terminal session survives renderer changes without fabricating a second PTY
- **WHEN** the same terminal session is rendered through different supported renderer stacks
- **THEN** the renderer change reuses the same terminal id, snapshot truth, and transport contract
- **AND** the renderer change does not fabricate a second terminal session

#### Scenario: WTerm stack stays private to the adapter
- **WHEN** the resolved renderer is `wterm`
- **THEN** the adapter may internally combine `@wterm/ghostty` core loading with `@wterm/dom` hosting
- **AND** the host still consumes only the shared terminal-view contract

### Requirement: Terminal viewport SHALL distinguish durable renderer preference from resolved renderer fact

The viewport and its consuming clients SHALL distinguish durable renderer preference from concrete resolved renderer fact.

#### Scenario: Auto preference resolves to a concrete renderer
- **WHEN** a terminal profile declares `rendererPreference = auto`
- **THEN** the front-end resolves one concrete renderer for the current environment
- **AND** the resolved renderer is exposed as a distinct fact from the durable preference

#### Scenario: Explicit preference does not silently degrade into another renderer
- **WHEN** a terminal profile declares an explicit concrete renderer preference such as `ghostty-web`, `wterm`, or `xterm`
- **THEN** the viewport attempts that renderer specifically
- **AND** it does not silently substitute a different renderer as if the explicit preference had succeeded

### Requirement: Current desktop WebUI SHALL resolve auto preference to ghostty-web

Current desktop WebUI SHALL resolve `rendererPreference = auto` to `ghostty-web` unless the host explicitly overrides that environment policy.

#### Scenario: Desktop auto preference selects ghostty-web
- **WHEN** the browser host renders a terminal on the current desktop WebUI surface with `rendererPreference = auto`
- **THEN** the resolved renderer is `ghostty-web`
- **AND** the viewport renders through the `ghostty-web` adapter instead of defaulting to xterm

### Requirement: Adapter-owned viewport facts SHALL replace renderer-private host probing

The shared viewport contract SHALL expose adapter-owned public facts for input, focus, scroll, title, screen metrics, and shared presentation mapping so hosts and tests do not probe renderer-private structures.

#### Scenario: Host reads screen metrics without renderer-private object access
- **WHEN** the host needs the rendered terminal screen size for fit or cover projection
- **THEN** it reads screen metrics from the shared viewport contract
- **AND** it does not inspect private renderer objects such as xterm internal render-service fields or wterm-private DOM internals

#### Scenario: Tests focus terminal input without renderer-private selectors
- **WHEN** a test needs to focus terminal input or verify focusability
- **THEN** it uses the shared viewport contract or adapter-owned public surface
- **AND** it does not depend on `.xterm-helper-textarea` or another renderer-private selector

### Requirement: Renderer stacks SHALL own presentation mapping

Renderer stack adapters SHALL map shared `theme + cursor + font` profile inputs into renderer-specific options or CSS variables inside the adapter boundary.

#### Scenario: Xterm-like stack maps shared presentation profile locally
- **WHEN** `xterm` or `ghostty-web` is the resolved renderer
- **THEN** the adapter maps shared presentation fields into renderer-local options
- **AND** host surfaces do not duplicate renderer-specific presentation mapping

#### Scenario: WTerm stack maps shared presentation profile locally
- **WHEN** `wterm` is the resolved renderer
- **THEN** the adapter maps shared presentation fields into the `WTerm` host's CSS-variable contract
- **AND** feature code does not write renderer-specific CSS variables itself

### Requirement: Renderer stacks SHALL declare presentation mutation policy

Renderer stack adapters SHALL declare whether shared presentation fields can settle through `live-apply` or require `rebuild-session`, so host code never invents renderer-specific capability branches.

#### Scenario: Ghostty-web theme mutation requires rebuild
- **WHEN** `ghostty-web` receives a durable theme mutation after the renderer is already open
- **THEN** the adapter policy reports that theme settlement requires `rebuild-session`
- **AND** `terminal-view` does not pretend that host-local live-apply is authoritative

#### Scenario: XTerm cursor mutation stays live
- **WHEN** `xterm` receives a cursor-style mutation while the terminal session stays on `xterm`
- **THEN** the adapter policy reports `live-apply`
- **AND** `terminal-view` keeps the same renderer session alive

### Requirement: Renderer stacks SHALL report native viewport metrics

Renderer stack adapters SHALL report native terminal content metrics through the shared viewport contract, and those metrics SHALL describe the renderer's intrinsic terminal content box rather than projected host scale.

#### Scenario: Host receives renderer-native geometry without reverse-projecting it
- **WHEN** a renderer session reports screen metrics through the shared adapter contract
- **THEN** those metrics describe the renderer's native content box for the current cols and rows
- **AND** host code does not divide them by fit/cover projection scale

#### Scenario: WTerm metrics ignore standalone host chrome defaults
- **WHEN** `wterm` is embedded inside the integrated terminal window
- **THEN** the adapter reports viewport metrics from the integrated terminal content surface
- **AND** default standalone host padding, card shadow, or radius do not become terminal-window geometry truth

#### Scenario: WTerm scroll host and content grid disagree
- **WHEN** `wterm` host scroll geometry differs from its active `.term-grid` content surface
- **THEN** the adapter reports the active terminal content metrics rather than the outer scroll-host box
- **AND** host code does not compensate by reverse-projecting or second-guessing the renderer metrics

