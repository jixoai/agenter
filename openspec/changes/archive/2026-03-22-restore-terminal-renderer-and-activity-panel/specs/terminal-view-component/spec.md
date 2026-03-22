## MODIFIED Requirements

### Requirement: Terminal-view SHALL preserve stable live rendering
The terminal renderer SHALL preserve ANSI rendering fidelity and stable fit-driven resizing while live transport is active.

#### Scenario: Live transport does not jitter under fallback updates
- **WHEN** live websocket transport is connected and fallback snapshots continue to update
- **THEN** the renderer does not reset backwards or visibly jitter
- **THEN** fallback hydration only applies when live transport is unavailable or behind

### Requirement: Terminal-view SHALL support terminal-local presentation controls
The integrated terminal surface SHALL expose terminal-local presentation controls including `fit` and `cover`.

#### Scenario: Switch between fit and cover modes
- **WHEN** the user toggles between `fit` and `cover`
- **THEN** the terminal surface updates its presentation mode
- **THEN** live transport remains connected and terminal content stays readable
