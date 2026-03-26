# attention-context-proof-view Specification

## Purpose
TBD - created by archiving change devtools-attention-commit-proof-vnext. Update Purpose after archive.
## Requirements
### Requirement: Attention inspector centers current context state
The attention inspector MUST show the current context state before commit history.

#### Scenario: Context tab shows live state
- **WHEN** a user opens an attention context
- **THEN** the default tab shows the context id, head commit id, current content, and current score map.

