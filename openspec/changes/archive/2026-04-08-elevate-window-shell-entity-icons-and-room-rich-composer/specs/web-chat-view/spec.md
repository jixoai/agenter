## ADDED Requirements

### Requirement: Web chat view SHALL expose a rich shared composer surface
The shared chat package SHALL render a responsive CodeMirror-based composer surface with attachment previews, action/status toolbars, help hints, and host-driven send orchestration instead of a minimal textarea-only input.

#### Scenario: Composer shows rich pending attachment state
- **WHEN** the host adds pending files, images, or screenshots to the shared composer
- **THEN** the chat package renders visible pending attachment previews before send
- **THEN** the same composer surface still owns Enter/Shift+Enter and toolbar interaction semantics

#### Scenario: Composer toolbar stays responsive
- **WHEN** the chat package is rendered in a compact or desktop container
- **THEN** the composer toolbar adapts its controls without hiding the primary send action
- **THEN** help/status hints remain available through the same shared surface

### Requirement: Web chat view SHALL render canonical avatar and message action affordances
The shared chat package SHALL support host-provided canonical avatar/icon resolution for room and actor identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation.

#### Scenario: Host resolves canonical avatars
- **WHEN** the host provides canonical icon or avatar URLs for the channel or participants
- **THEN** the shared message rows render those canonical avatars in transcript presentation
- **THEN** the chat package does not guess durable identity solely from visible labels

#### Scenario: Shared row exposes local message actions
- **WHEN** the operator hovers or context-clicks a transcript row
- **THEN** the row reveals the shared local message action affordance
- **THEN** host routes can extend those actions without replacing the shared row renderer
