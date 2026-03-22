## Purpose

Define regression coverage for message and terminal source adapter integrations.

## Requirements

### Requirement: Source integration SHALL include a cross-package regression plan
Message-system and terminal-system adaptation to the LoopBus attention-source pipeline SHALL be covered by a dedicated regression plan spanning package-level and integration-level behavior.

#### Scenario: Verify message adapter behavior
- **WHEN** the regression plan is executed for message-system integration
- **THEN** it covers committed-message invalidation, attention draft creation, and no-delta/no-cycle behavior
- **THEN** regressions can be localized to message-system, app-server integration, or shared adapter logic

#### Scenario: Verify focused terminal adapter behavior
- **WHEN** the regression plan is executed for terminal-system integration
- **THEN** it covers focused-terminal semantic changes, attention draft creation, and cycle-gating behavior
- **THEN** regressions can be localized to terminal-system, app-server integration, or shared adapter logic
