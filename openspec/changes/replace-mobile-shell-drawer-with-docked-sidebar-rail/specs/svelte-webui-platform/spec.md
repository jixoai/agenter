## ADDED Requirements

### Requirement: Compact app shell SHALL keep the left window-switcher rail visible
The top-level WebUI shell SHALL keep the left application sidebar visible on compact viewports as the persistent window switcher. Compact layouts MAY collapse that rail to icon width, but SHALL NOT hide primary navigation behind a drawer or page-local reopen control.

#### Scenario: Mobile shell keeps the window switcher visible
- **WHEN** the operator opens the WebUI on an iPhone 14-sized viewport
- **THEN** the left rail still renders the primary `Avatars`, `Messages`, and `Terminals` navigation surface
- **THEN** the shell does not require a page-local toolbar button to reopen primary navigation

#### Scenario: Compact rail can expand from sidebar chrome
- **WHEN** the compact app shell starts in collapsed icon mode
- **THEN** the operator can expand or collapse the same left rail from controls inside sidebar chrome
- **THEN** the current workbench window stays responsible only for page-local chrome
