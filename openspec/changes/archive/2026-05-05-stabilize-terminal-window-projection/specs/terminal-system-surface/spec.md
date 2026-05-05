## MODIFIED Requirements

### Requirement: Terminal window projection SHALL resize the window shell, not only the terminal content

The terminal-system route SHALL treat `fit` and `cover` as host-owned window-shell projection modes relative to the `window-container` safe area. The selected terminal window SHALL change its own shell semantics under those modes, while the titlebar remains an unscaled control surface with stable hit targets.

#### Scenario: Fit projection shrinks only terminal content inside a framed window shell
- **WHEN** the operator switches a terminal window to `fit`
- **THEN** only terminal content scales to remain fully visible inside the available safe area
- **AND** the titlebar height and control hit targets stay stable instead of being transform-scaled
- **AND** the terminal screen remains flush to the visible window body edges instead of floating inside a second inset frame

#### Scenario: Fit projection resolves inline-fit and block-fit from safe-area aspect ratio
- **WHEN** the terminal content aspect ratio is wider than the safe-area aspect ratio
- **THEN** the projection resolves `inline-fit` and visibly fills the safe-area width while leaving remaining block-axis space
- **AND** when the terminal content aspect ratio is taller than the safe-area aspect ratio the projection resolves `block-fit` and visibly fills the safe-area height while leaving remaining inline-axis space

#### Scenario: Cover projection becomes a frameless fullscreen-like shell
- **WHEN** the operator switches a terminal window to `cover`
- **THEN** the terminal shell removes its window frame and keeps the titlebar pinned to the top of the stage viewport
- **AND** terminal content stays at native scale instead of growing above `scale = 1`
- **AND** the surrounding stage viewport owns the resulting outer scrollbars

#### Scenario: Cover projection does not expose a live resize handle
- **WHEN** the terminal window is in `cover`
- **THEN** the terminal window does not expose a frame-corner live resize handle
- **AND** only framed fit-mode windows may present the live resize affordance

#### Scenario: Titlebar controls stay minimal and stateful
- **WHEN** the terminal window titlebar renders
- **THEN** it exposes exactly two macOS-style circular control primitives
- **AND** one circle projects the current lifecycle state as blue `bootstrap` or red `kill`
- **AND** the other circle projects the current projection mode as yellow `fit` or green `cover`
- **AND** the circles do not render icons, inline labels, or a third destructive control category

#### Scenario: Titlebar inline-end shows size information only
- **WHEN** the terminal window titlebar renders
- **THEN** the inline-end metadata is limited to terminal size information
- **AND** the titlebar does not repeat transport, projection, or other multi-chip status labels there

#### Scenario: Fit-cover does not mutate terminal geometry by itself
- **WHEN** the operator toggles between `fit` and `cover`
- **THEN** the terminal snapshot `cols x rows` stay unchanged
- **AND** only explicit live drag resize or durable resize form submission may request PTY geometry changes

#### Scenario: Live resize derives terminal geometry from the dragged window frame
- **WHEN** the operator drags the terminal window resize handle in framed fit mode
- **THEN** the window frame may follow the pointer as a temporary projection while dragging
- **AND** the route derives discrete PTY `cols x rows` from the dragged frame size using the terminal cell metrics
- **AND** the live transport sends a resize sideband for those derived `cols x rows` only from the resize gesture path itself
- **AND** those live resize sidebands are emitted on drag move and drag end, rather than by unrelated reactive frame updates
- **AND** on pointer release the temporary frame dimensions are discarded so the terminal window is again sized by terminal content geometry
- **AND** the titlebar size label reflects the effective `cols x rows` rather than preserving arbitrary drag pixels

### Requirement: Actions reflect explicit lifecycle operations

The terminal-system route SHALL keep PTY lifecycle operations distinct from destructive terminal catalog deletion.

#### Scenario: Running terminal exposes kill separately from deletion
- **WHEN** a terminal is `running`
- **THEN** the route exposes `Kill PTY` as the lifecycle operation
- **AND** terminal deletion remains a separate destructive catalog action outside the terminal titlebar control primitive

#### Scenario: Stopped route stays open
- **WHEN** the operator stops a terminal PTY
- **THEN** the route stays on that terminal and disables read/write surfaces until bootstrap
- **AND** only deleting the terminal removes it from the route/catalog
