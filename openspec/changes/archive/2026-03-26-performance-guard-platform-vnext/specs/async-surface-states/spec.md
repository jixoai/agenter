## ADDED Requirements

### Requirement: Shared async surface primitives SHALL support long-list pagination affordances
The shared async surface contract SHALL support long-list loading without clearing already visible content or forcing panel-specific loading shells.

#### Scenario: Loading older pages keeps the populated list visible
- **WHEN** a panel already displays a populated long list and requests an older page
- **THEN** the existing rows remain visible during that pagination request
- **THEN** the panel uses the shared async-surface affordance for pagination progress instead of clearing the list or hand-rolling a custom shell

#### Scenario: First-load and refresh treatments stay distinct for long lists
- **WHEN** a long-list panel has not hydrated any rows yet and begins its first fetch
- **THEN** it renders the shared first-load treatment
- **THEN** later refresh or older-page requests reuse the shared non-destructive ready-state affordances instead of reverting to empty-state copy
