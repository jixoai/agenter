## ADDED Requirements

### Requirement: Terminal viewport rendering SHALL resolve a durable renderer preference through a shared adapter contract

The standalone terminal viewport layer SHALL resolve durable terminal renderer preference through a shared adapter contract instead of binding host code to one renderer's private DOM, metrics, or input internals.

#### Scenario: Host embeds one terminal viewport without renderer-private DOM assumptions
- **WHEN** a host embeds `terminal-view` for a terminal with a durable renderer preference
- **THEN** the viewport resolves that preference through a shared renderer adapter contract
- **AND** the host does not need direct knowledge of renderer-private DOM classes, helper textareas, or metric internals

#### Scenario: One terminal session survives renderer changes without fabricating a second PTY
- **WHEN** the same terminal session is rendered through different supported viewport adapters
- **THEN** the renderer change reuses the same terminal id, snapshot truth, and transport contract
- **AND** the renderer change does not fabricate a second terminal session

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

The shared viewport contract SHALL expose adapter-owned public facts for input, focus, scroll, title, and screen metrics so hosts and tests do not probe renderer-private structures.

#### Scenario: Host reads screen metrics without renderer-private object access
- **WHEN** the host needs the rendered terminal screen size for fit or cover projection
- **THEN** it reads screen metrics from the shared viewport contract
- **AND** it does not inspect private renderer objects such as xterm internal render-service fields

#### Scenario: Tests focus terminal input without renderer-private selectors
- **WHEN** a test needs to focus terminal input or verify focusability
- **THEN** it uses the shared viewport contract or adapter-owned public surface
- **AND** it does not depend on `.xterm-helper-textarea` or another renderer-private selector
