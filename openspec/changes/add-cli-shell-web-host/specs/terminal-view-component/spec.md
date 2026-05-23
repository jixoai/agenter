> Superseded note:
> This delta spec is built on the older `terminal-1` / `terminal-2` cli-shell ontology.
> It remains only as historical input. Any future Web-host product work must be redesigned under `realign-cli-shell-with-core-system-boundaries`.

## MODIFIED Requirements

### Requirement: The system SHALL let cli-shell Web host reuse `web-terminal-view` directly

The official browser-facing `cli-shell --web` host SHALL reuse `web-terminal-view` as its protocol-1 projection primitive for terminal-2 instead of introducing a second product-local Web terminal implementation.

#### Scenario: Cli-shell Web host mounts `web-terminal-view`
- **WHEN** cli-shell starts in Web host mode
- **THEN** the served browser page mounts `web-terminal-view` for terminal-2
- **AND** cli-shell does not bypass the shared terminal-view component family with a second bespoke browser terminal surface
- **AND** the browser host does not need to decode cli-shell protocol 2 just to render the official product surface

### Requirement: Web-terminal-view used by cli-shell Web host SHALL remain DOM-accessible

When `web-terminal-view` is used as the `cli-shell --web` shell surface, the resulting browser terminal projection SHALL remain DOM-observable enough for focus, accessible text, and browser-driven interaction acceptance.

#### Scenario: Browser acceptance can observe shell focus and text through DOM
- **WHEN** browser-driven acceptance opens `cli-shell --web`
- **THEN** the terminal surface exposes DOM-observable focus and text behavior sufficient for browser acceptance
- **AND** the product does not depend on a canvas-only shell surface for its official Web host mode
