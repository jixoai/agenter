## MODIFIED Requirements

### Requirement: Superadmin onboarding SHALL keep the key-auth flow visible and operable on compact screens
The WebUI SHALL render root-auth onboarding inside a dialog that keeps identity context, key entry, and authenticate actions visible without overlapping or losing scroll ownership on compact and desktop viewports.

#### Scenario: Onboarding dialog derives from dialog scaffold law
- **WHEN** the root-auth onboarding dialog content exceeds the available viewport
- **THEN** the dialog chrome stays fixed through a shared dialog scaffold primitive
- **THEN** only the dialog body scrolls while the authenticate actions remain available
