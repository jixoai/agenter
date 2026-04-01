## ADDED Requirements

### Requirement: Runtime SHALL assemble provider-owned system guides

The runtime kernel SHALL assemble the model `systemPrompt` from shared prompt documents plus provider-owned system-guide sections contributed by active tool providers. Those guides SHALL stay in the system-prompt layer and SHALL NOT be serialized as prompt-window chat messages or synthetic runtime help inputs.

#### Scenario: Active providers contribute their own system guidance

- **WHEN** a model call is prepared with one or more active tool providers
- **THEN** the kernel collects each provider's system-guide section in provider registration order
- **AND** injects the combined result into the model `systemPrompt`

#### Scenario: Provider guidance stays out of replay history

- **WHEN** a provider contributes a system-guide section
- **THEN** the guidance is visible in the outbound model `systemPrompt`
- **AND** it does not appear as a replayed assistant or user message in the bounded prompt window

#### Scenario: Legacy templates still receive provider guidance

- **WHEN** the configured `SYSTEM_TEMPLATE` does not yet expose a `SYSTEMS_GUIDE` slot
- **THEN** the kernel still injects provider-owned guidance through a fallback placement near the core system prompt
- **AND** the guidance reaches the model without requiring synthetic runtime messages
