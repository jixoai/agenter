## ADDED Requirements

### Requirement: Terminal window titlebar SHALL expose one local presentation config panel

The selected terminal window titlebar SHALL expose one icon-only presentation config control on its inline-end. Activating that control SHALL open one dialog with local draft state. The same titlebar payload SHALL appear in both fit and cover modes; in cover mode the titlebar stays sticky at the top of the surrounding `window-container`.

#### Scenario: Fit and cover share one titlebar payload
- **WHEN** the operator toggles between `fit` and `cover`
- **THEN** the titlebar keeps the same window title, lifecycle control, fit-cover control, geometry text, and config icon control
- **AND** cover mode only changes chrome ownership and stickiness, not titlebar content

#### Scenario: Config dialog stages presentation draft locally
- **WHEN** the operator opens the titlebar config dialog
- **THEN** the dialog lets them change terminal theme, renderer preference, font family, and font size
- **AND** browsing those draft values does not immediately mutate terminal-system durable truth

#### Scenario: Apply commits the staged presentation draft
- **WHEN** the operator confirms `Apply` from the titlebar config dialog
- **THEN** the staged presentation draft writes through the browser-authenticated terminal config mutation path for that terminal id
- **AND** `Cancel` leaves the durable presentation profile unchanged

#### Scenario: Running terminal reflects titlebar config changes without losing PTY identity
- **WHEN** the operator changes theme, font, or renderer preference from the titlebar panel on a running terminal
- **THEN** the visible terminal window updates in place or rebuilds only its local renderer stack
- **AND** the route keeps the same terminal id, PTY lifecycle state, and current fit-cover mode

#### Scenario: Applying state waits for renderer-settled ack
- **WHEN** the operator applies a presentation mutation that reaches terminal-system durable truth
- **THEN** the titlebar config dialog stays in its local applying state until `terminal-view-presentation-ready` confirms visible settlement
- **AND** the host does not infer renderer completion only from the server mutation response

### Requirement: Terminal window projection SHALL follow renderer-measured native content

The integrated terminal window SHALL size fit/cover projection from renderer-measured native terminal content once those measurements are available. Bootstrap cell-size formulas MAY be used only before the renderer reports native metrics.

#### Scenario: Fit mode follows measured native content
- **WHEN** a live renderer session reports native terminal content metrics
- **THEN** fit projection uses those metrics to compute shell width, shell height, and content box size
- **AND** the host does not continue using fallback formula metrics as final geometry truth

#### Scenario: Cover mode keeps native renderer content aligned with the window shell
- **WHEN** a live renderer session reports native terminal content metrics in cover mode
- **THEN** the terminal window body, scroll container, and terminal content remain aligned to the same native content box
- **AND** cover mode does not invent extra spacing between `terminal-content` and `terminal-window`
