## MODIFIED Requirements

### Requirement: Image affordances SHALL remain available independently from provider image-input compatibility
The WebUI SHALL expose image attachment affordances whenever the session transport supports session asset uploads, even if the currently resolved provider configuration does not accept image input for model requests. When the current model cannot consume image input, the composer MUST surface compatibility feedback at send time instead of hiding attachment affordances.

#### Scenario: Image attachment UI remains available with transport support
- **WHEN** the current workspace/session can upload session assets
- **THEN** Quick Start and Chat both show image paste, drop, pick, and screenshot affordances
- **THEN** those affordances do not disappear solely because the current provider lacks image-input capability

#### Scenario: Incompatible image send shows clear feedback
- **WHEN** the user attempts to send a draft that includes image attachments while the current model does not accept image input
- **THEN** the composer shows a clear compatibility notice
- **THEN** the user is not forced to infer failure from missing attachment controls
