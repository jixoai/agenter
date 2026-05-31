## ADDED Requirements

### Requirement: Terminal-view SHALL behave as a viewport primitive
The standalone `terminal-view` component SHALL own terminal renderer lifecycle, snapshot hydration, live transport updates, and viewport sizing only. App-level chrome such as titlebars, metadata footers, and decorative backgrounds MUST remain in the host surface.

#### Scenario: Host owns app chrome
- **WHEN** a host embeds `terminal-view`
- **THEN** the component renders the terminal viewport without app-level title or footer chrome
- **THEN** the host remains responsible for surrounding shell visuals and metadata placement

## MODIFIED Requirements

### Requirement: The system SHALL provide a standalone terminal-view WebComponent
The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract, and renderer hosts SHALL be able to embed it as a pure terminal viewport without depending on WebUI-local terminal internals.

#### Scenario: Embed terminal-view in a host surface
- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal viewport and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals

### Requirement: Terminal-view SHALL support terminal-local presentation controls
The integrated terminal viewport SHALL expose terminal-local presentation controls including `fit` and `cover`, while leaving non-terminal app chrome to the host.

#### Scenario: Switch between fit and cover modes
- **WHEN** the host toggles between `fit` and `cover`
- **THEN** the terminal viewport updates its presentation mode
- **THEN** live transport remains connected and terminal content stays readable

## REMOVED Requirements

### Requirement: Terminal-view SHALL support renderer-engine selection and terminal titles
**Reason**: Renderer-engine selection and app display chrome are no longer part of the viewport primitive contract.

**Migration**: Hosts must render title/status chrome from terminal surface projection state, while `terminal-view` remains responsible only for viewport rendering and transport hydration.
