## MODIFIED Requirements

### Requirement: Terminal-system workbench SHALL expose a focused split-detail route

The WebUI SHALL expose a dedicated terminal-system route that lists global terminals, lets the operator select one terminal, and renders that terminal's focused action/detail workspace without requiring a session route.

#### Scenario: Terminal read/write composer keeps parameters and submit action in one grammar

- **WHEN** the operator switches between terminal write and terminal read in the bottom action area
- **THEN** write payload text remains the primary multiline composer body
- **THEN** read-mode parameter fields live in the upper parameter panel so future read options can extend there without changing the bottom action row grammar
- **THEN** the actor selector renders as a compact single-line affordance inside the composer addon row
- **THEN** the submit action lives in that same addon row instead of drifting into a separate footer band
- **THEN** read submissions send the selected actor's terminal access token and `remark = true` so UI reads consume only that actor's read cursor
