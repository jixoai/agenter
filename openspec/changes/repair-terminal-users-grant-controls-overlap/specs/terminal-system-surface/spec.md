## ADDED Requirements

### Requirement: Terminal Users pane SHALL keep grant controls independently hittable across pane widths
The terminal Users pane SHALL derive its grant-access control layout from the pane width itself, not only from the browser viewport, so the actor selector, role selector, and `Grant seat` action remain independently interactable inside narrow collaboration rails.

#### Scenario: Narrow desktop detail pane falls back to stacked grant controls
- **WHEN** the operator opens `Terminals > Users` on a desktop viewport whose collaboration rail is still narrow
- **THEN** the Users pane falls back to the stacked grant-access layout
- **THEN** `Grant actor`, `Grant role`, and `Grant seat` remain separately hittable instead of overlapping

#### Scenario: Mobile users pane keeps grant access usable
- **WHEN** the operator opens `Terminals > Users` on a compact mobile viewport
- **THEN** the Users pane continues to show the stacked grant-access layout
- **THEN** the actor selector and role selector can still be opened before granting a seat
