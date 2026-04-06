## MODIFIED Requirements

### Requirement: Runtime SHALL inject avatar identity into shared prompt docs

The runtime kernel SHALL provide the current avatar identity to shared prompt documents through prompt slots before assembling the outbound `systemPrompt`.

#### Scenario: Shared prompt docs render the current avatar name
- **WHEN** a runtime prepares a model call for avatar `jane`
- **THEN** `AGENTER_SYSTEM` renders `jane` through the `AVATAR_NAME` slot
- **AND** the outbound `systemPrompt` no longer hardcodes `agenter-ai`

#### Scenario: Prompt identity remains stable without an explicit avatar override
- **WHEN** a runtime prepares a model call without a configured avatar name
- **THEN** the shared prompt docs still render a stable default assistant identity
- **AND** the prompt assembly does not leave unresolved `AVATAR_NAME` placeholders in the final `systemPrompt`
