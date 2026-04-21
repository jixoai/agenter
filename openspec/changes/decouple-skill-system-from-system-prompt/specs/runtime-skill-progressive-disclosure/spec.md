## MODIFIED Requirements

### Requirement: Global runtime prompts SHALL teach real-path skill expansion
The global runtime prompts SHALL teach AI to expand skill detail progressively by using the canonical skill snapshot, then `skill info <skill>`, then reading only the needed sibling reference files from the real filesystem path returned by the runtime.

#### Scenario: AI learns to expand one reference file on demand through the skill surface
- **WHEN** the runtime prompt explains how to use skills
- **THEN** it states that `skill info <skill>` returns the real `SKILL.md` path
- **AND** it instructs the model to inspect only the needed `references/*.md` files via shell from that path when more detail is required
- **AND** it does not teach `ccski` as the public runtime command contract
