## ADDED Requirements

### Requirement: Runtime skill outline SHALL apply only when the generated outline changes

The runtime skill attention context SHALL represent the current skills outline. The outline SHALL be generated from skill name and description, not from implementation details such as watched reference content or filesystem paths. Runtime skill refresh SHALL publish context-applying outline ingress only when that generated outline changes.

#### Scenario: Description change updates skill context
- **GIVEN** the runtime skill context contains the current skill outline
- **WHEN** a skill is added, removed, renamed, or its description changes
- **THEN** runtime skill snapshot ingress applies the new generated outline to the skill context

#### Scenario: Internal skill detail change does not rewrite outline
- **GIVEN** the runtime skill context contains the current skill outline
- **WHEN** only watched internal skill files or references change without changing skill names or descriptions
- **THEN** runtime may emit skill-change attention items
- **AND** runtime does not publish a context-applying skill outline ingress
- **AND** the skill `attentionContext` content remains unchanged
