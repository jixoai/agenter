## ADDED Requirements

### Requirement: Runtime guidance SHALL teach ordinary-user delivery and resource recovery
The runtime SHALL provide shared prompt law plus dynamic system guides that are strong enough for ordinary-user requests. Those guides SHALL help the model translate vague intent into delivery work, recover missing runtime resources through tools, and coordinate clearly in shared rooms without needing test-scripted user instructions.

#### Scenario: Message guidance keeps replies plain and outcome-oriented for non-technical users
- **WHEN** a user asks for software help in ordinary language
- **THEN** runtime guidance helps the model acknowledge the work, keep the user informed in plain language, and report concrete outcomes instead of pushing implementation details back onto the user

#### Scenario: Terminal guidance teaches self-service recovery
- **WHEN** software delivery work requires a terminal and no live terminal context is immediately available
- **THEN** runtime guidance teaches the model to create a terminal if missing, or recover context through terminal inspection tools if one already exists
- **AND** the model does not need the user to script that recovery sequence explicitly

#### Scenario: Workspace guidance teaches real on-disk delivery
- **WHEN** the model is preparing files for delivery inside a granted workspace
- **THEN** runtime guidance teaches it to treat the mounted workspace as the real project area, write files there, and verify delivery from workspace truth
- **AND** room chat is not treated as a substitute for writing real files to disk
