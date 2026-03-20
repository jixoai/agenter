## ADDED Requirements

### Requirement: Workspace settings SHALL adapt layer detail presentation by viewport class
The WebUI SHALL present workspace setting layers as a split pane on expanded or landscape viewports and as a right-side detail sheet on compact or medium portrait viewports.

#### Scenario: Desktop or landscape settings uses split layer detail
- **WHEN** the user opens workspace Settings on an expanded viewport or any landscape viewport and activates the `Layer Sources` view
- **THEN** the sources list and layer editor are visible side by side
- **THEN** selecting a source updates the in-page editor pane

#### Scenario: Portrait compact settings uses right-sheet layer detail
- **WHEN** the user opens workspace Settings on a compact or medium portrait viewport, activates `Layer Sources`, and selects a source
- **THEN** the layer editor opens in a right-side sheet
- **THEN** the sources list remains the primary in-page panel behind that sheet
