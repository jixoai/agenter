## MODIFIED Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL continue to expose technical session inspection panels, but those panels SHALL be flattened into the running-avatar detail shell as peer runtime tabs instead of being hidden behind a separate `Devtools` wrapper tab. `Attention` SHALL remain the default entry point, while cycle-oriented, terminal-oriented, LoopBus-oriented, and model-oriented inspection details remain available as sibling runtime tabs.

#### Scenario: Technical inspection panels are flattened into runtime tabs
- **WHEN** the user opens a running-avatar detail shell
- **THEN** technical inspection panels such as `Cycles`, `Systems`, `Observability`, and related runtime tabs are available directly at the shell tab level
- **THEN** the user does not need to first enter a `Devtools` wrapper tab before reaching them

#### Scenario: Attention remains the default technical entry
- **WHEN** the user opens a running-avatar detail shell
- **THEN** the shell selects `Attention` by default
- **THEN** deeper technical inspection tabs remain available without changing the default landing priority
