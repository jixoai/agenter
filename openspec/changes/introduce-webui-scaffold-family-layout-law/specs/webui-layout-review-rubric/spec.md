## MODIFIED Requirements

### Requirement: Storybook layout verification SHALL be component-first before route assembly
The WebUI layout review flow SHALL lock primitive layout contracts before relying on composite or page-level assembly stories. Scaffold-family primitives SHALL be treated as first-class layout contracts, and layout enforcement SHALL include both template source-contract checks and script-level lint where technically possible.

#### Scenario: Layout law adds a new scaffold primitive
- **WHEN** a shared scaffold-family primitive is introduced or modified
- **THEN** the change includes primitive stories and DOM-contract evidence before page-level stories become the acceptance gate
- **THEN** the review flow may add `oxlint` rules for script-level boundaries, but template-level layout ownership is still verified by source-contract tests
