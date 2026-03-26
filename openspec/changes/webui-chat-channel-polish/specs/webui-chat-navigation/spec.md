## MODIFIED Requirements

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the unified top header and route region, and the workspace route surface owns route content plus route-local notices and actions. Adjacent shell layers MUST NOT repeat the same passive state as visible text if an icon signal or tooltip already owns that fact, and desktop SHALL NOT introduce a second status trigger model that differs from compact layouts.

#### Scenario: Workspace route content is not wrapped by duplicate padding stacks
- **WHEN** a workspace route renders Chat, Devtools, or Settings content
- **THEN** the outer application shell does not inject a second competing content padding layer inside the workspace scaffold
- **THEN** the workspace route keeps visual priority over surrounding shell chrome

#### Scenario: Passive state signals avoid redundant text stacks
- **WHEN** the shell renders connection or AI state in the top header
- **THEN** those facts are expressed through compact signals with accessible tooltip-backed labels
- **THEN** the header does not also repeat the same passive state as additional long text lines unless the signal itself is unavailable

#### Scenario: Session status affordance stays consistent across viewports
- **WHEN** the user opens Chat on desktop or mobile
- **THEN** the session status trigger uses the same compact signal-driven model in both layouts
- **THEN** the shell does not add a separate desktop-only pill or select trigger for the same status fact
