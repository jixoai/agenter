## MODIFIED Requirements

### Requirement: Adaptive icon affordances SHALL preserve one semantic action across width changes
Reusable icon affordances SHALL be implemented through shared primitives that can show icon+label or icon-only presentations based on available inline size without changing their semantic action, accessible name, tooltip fallback, or hit-target geometry. When the label collapses, the control SHALL switch to icon-only padding that keeps the trigger centered instead of retaining label-oriented inline spacing.

#### Scenario: Control collapses to icon-only
- **WHEN** the affordance container becomes too narrow to fit both icon and label
- **THEN** the control hides the label and keeps the icon visible
- **THEN** the control still exposes an accessible name and tooltip fallback

#### Scenario: Icon-only control keeps balanced padding
- **WHEN** an adaptive affordance is rendered in icon-only mode
- **THEN** the trigger uses compact symmetric inline padding instead of label-width padding
- **THEN** the icon remains visually centered and the hit target remains stable

#### Scenario: Control expands back to icon plus label
- **WHEN** the affordance regains enough inline space
- **THEN** the label becomes visible again without remounting the action
- **THEN** the interaction semantics stay unchanged
