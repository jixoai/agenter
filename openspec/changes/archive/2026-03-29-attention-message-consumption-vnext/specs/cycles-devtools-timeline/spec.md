## MODIFIED Requirements

### Requirement: Devtools SHALL expose a live cycle timeline

The WebUI SHALL expose the cycle-oriented Devtools surface as a live timeline that summarizes cycle state, timing, and model/tool activity while the session is running, but that surface MUST keep its typography, density, and color hierarchy visually subordinate to the main Chat route.

#### Scenario: Compact cycles are visually distinct special rounds

- **WHEN** the timeline renders a cycle whose kind is `compact`
- **THEN** that row uses a distinct icon or color treatment from normal rounds
- **AND** the user can identify compact cycles directly from navigation without opening the detail pane
