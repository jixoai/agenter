# persistent-help-hints Specification

## Purpose
Define the durable WebUI contract for contextual `?` help disclosures that onboard first-time users without permanently occupying layout space.

## Requirements
### Requirement: WebUI contextual help SHALL use persistent `?` disclosures
Panels and dialog headers that provide non-critical explanatory guidance SHALL expose that guidance through a reusable `?` help disclosure instead of always-visible helper text blocks.

#### Scenario: Helper guidance is shown through a reusable trigger
- **WHEN** a surface needs to provide optional guidance
- **THEN** the surface renders a `?` help hint trigger
- **THEN** the guidance content is available in the hint popup instead of occupying persistent body copy space

### Requirement: Help hints SHALL auto-open before first dismissal
Each help hint SHALL open by default for users who have not dismissed that exact hint yet.

#### Scenario: First visit opens contextual help automatically
- **WHEN** the user loads a surface containing a help hint for the first time
- **THEN** the hint popup opens without requiring hover
- **THEN** the auto-opened popup uses a passive onboarding presentation that stays visually lighter than an explicitly opened tooltip
- **THEN** clicking the trigger dismisses and closes the popup

#### Scenario: User intent upgrades the hint to the normal tooltip presentation
- **GIVEN** a help hint is still in its first-visit auto-open state
- **WHEN** the user hovers, focuses, or explicitly re-opens the `?` trigger
- **THEN** the hint switches to the standard tooltip presentation
- **THEN** any passive onboarding animation stays paint-only and does not shift the popup layout

### Requirement: Help hint dismissal SHALL persist by deterministic key
Dismissal state SHALL be persisted in IndexedDB and keyed deterministically by normalized hint context (`sha256(textContext)`), optionally namespaced by a stable `helpId`.

#### Scenario: Reload keeps dismissed state
- **WHEN** the user dismisses a help hint and reloads the app
- **THEN** that hint does not auto-open again
- **THEN** the dismissal key remains stable for semantically equivalent context text

### Requirement: Dismissed hints SHALL remain discoverable
After dismissal, users SHALL still be able to re-open hint content via hover or click on the same `?` trigger.

#### Scenario: Returning user re-opens help on demand
- **WHEN** a dismissed help hint trigger is hovered or clicked
- **THEN** the popup re-opens with the same guidance content
- **THEN** the trigger remains keyboard and pointer accessible
