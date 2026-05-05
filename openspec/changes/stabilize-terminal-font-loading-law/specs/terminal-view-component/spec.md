## MODIFIED Requirements

### Requirement: Terminal-view SHALL consume one shared terminal presentation profile

The standalone `terminal-view` component SHALL consume shared declarative `rendererPreference`, `theme`, `cursor`, and `font` inputs and apply them through the resolved renderer stack.

#### Scenario: Terminal-view owns optional terminal font assets during presentation settle
- **WHEN** the host selects an optional terminal webfont such as `JetBrains Mono`
- **THEN** `terminal-view` injects and prepares its own terminal font asset before renderer-local settle
- **AND** host surfaces do not need WebUI-global `@fontsource` imports for terminal correctness

#### Scenario: Terminal-view keeps terminal font asset source explicit even if the host declares the same family
- **WHEN** the document already contains another `@font-face` with the same family name
- **THEN** `terminal-view` still keeps its own terminal font asset declaration as the authoritative source for optional terminal webfonts
- **AND** the terminal surface does not silently inherit host-local CSS privilege
