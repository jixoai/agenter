## ADDED Requirements

### Requirement: Adaptive icon affordances SHALL preserve one semantic action across width changes
Reusable icon affordances SHALL be able to show icon+label or icon-only presentations based on available inline size without changing their semantic action, accessible label, or tooltip fallback.

#### Scenario: Control collapses to icon-only
- **WHEN** the affordance container becomes too narrow to fit both icon and label
- **THEN** the control hides the label and keeps the icon visible
- **THEN** the control still exposes an accessible name and tooltip fallback

#### Scenario: Control expands back to icon plus label
- **WHEN** the affordance regains enough inline space
- **THEN** the label becomes visible again without remounting the action
- **THEN** the interaction semantics stay unchanged
