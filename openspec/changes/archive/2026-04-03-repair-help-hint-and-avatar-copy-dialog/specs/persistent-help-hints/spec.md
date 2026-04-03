## MODIFIED Requirements

### Requirement: WebUI contextual help SHALL use persistent `?` disclosures
Panels and dialog headers that provide non-critical explanatory guidance SHALL expose that guidance through a reusable `?` help disclosure instead of always-visible helper text blocks. The default disclosure state SHALL remain quiet unless the host explicitly opts into onboarding behavior.

#### Scenario: Helper guidance is shown through a reusable trigger
- **WHEN** a surface needs to provide optional guidance
- **THEN** the surface renders a `?` help hint trigger
- **THEN** the guidance content is available in the hint popup instead of occupying persistent body copy space

### Requirement: Help hints SHALL stay closed by default unless a surface explicitly enables passive first-visit onboarding
Each help hint SHALL remain closed on first render by default. A surface MAY explicitly opt into one-time passive onboarding for that exact hint identity.

#### Scenario: First visit stays collapsed by default
- **WHEN** the user loads a surface containing a standard help hint for the first time
- **THEN** the hint popup does not open automatically
- **THEN** the primary surface content remains unobscured until explicit user intent

#### Scenario: Explicit onboarding opt-in opens context passively once
- **GIVEN** a help hint explicitly enables passive first-visit onboarding
- **WHEN** the user loads that surface before dismissing that exact hint identity
- **THEN** the hint popup opens in a passive onboarding presentation
- **THEN** that passive presentation remains visually lighter than an explicitly opened tooltip

#### Scenario: User intent opens a fresh hint without prior dismissal
- **WHEN** the user hovers, focuses, clicks, or uses the global `?` shortcut for a help hint that has never been dismissed
- **THEN** the hint content becomes visible without requiring a prior persisted dismissal record
- **THEN** the help hint remains keyboard and pointer accessible

### Requirement: Passive onboarding dismissal SHALL persist by deterministic key
When a surface explicitly enables passive first-visit onboarding, dismissal state SHALL persist in IndexedDB and be keyed deterministically by normalized hint context (`sha256(textContext)`), optionally namespaced by a stable `helpId`.

#### Scenario: Reload keeps a dismissed onboarding hint closed
- **WHEN** the user dismisses an onboarding-enabled help hint and reloads the app
- **THEN** that hint does not auto-open again
- **THEN** the dismissal key remains stable for semantically equivalent context text

### Requirement: Hints SHALL remain discoverable after dismissal
After dismissal, users SHALL still be able to re-open hint content via hover, focus, click, or the global `?` shortcut on the same `?` trigger.

#### Scenario: Returning user re-opens help on demand
- **WHEN** a dismissed help hint trigger is hovered, focused, clicked, or opened from the global shortcut
- **THEN** the popup re-opens with the same guidance content
- **THEN** the trigger remains keyboard and pointer accessible
