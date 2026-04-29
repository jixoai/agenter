## MODIFIED Requirements

### Requirement: The platform SHALL expose system-first navigation with nested secondary entries

The top-level WebUI shell SHALL expose `Avatars`, `Skills`, `Messages`, `Workspaces`, and `Terminals` as the durable primary destinations. Each primary destination MAY expose nested secondary entries directly beneath itself inside the same left sidebar. `pin` SHALL be modeled as state on those secondary entries, rather than as a separate global `Pinned` section. The shell SHALL expose `/admin` only through the footer superadmin affordance, and running avatars SHALL appear as dynamic tabs inside the Avatars workbench instead of a separate primary destination, global top bar, or detached secondary rail card. The shell SHALL NOT inject a redundant top header or refresh-only control above the currently selected workbench window.

#### Scenario: Primary shell exposes exactly five destinations

- **WHEN** the operator opens the WebUI
- **THEN** the left primary navigation shows `Avatars`, `Skills`, `Messages`, `Workspaces`, and `Terminals`
- **THEN** neither global settings nor running avatars are promoted into some sixth primary destination

#### Scenario: Secondary entries stay attached to their owning primary destination

- **WHEN** the shell renders recent or open resources such as rooms, workspaces, runtime entries, or dedicated avatar skill tabs
- **THEN** those resources appear as nested secondary entries under their owning primary destination when the IA requires sidebar presence
- **THEN** the shell does not move them into a detached global rail or a separate `Pinned` block

#### Scenario: Pin state belongs to each nested secondary entry

- **WHEN** the operator pins a nested secondary entry such as a room or workspace
- **THEN** the left sidebar marks that entry itself as pinned inside its owning primary destination
- **THEN** the pin state lets that entry outlive the default recent-entry cap without reparenting it into another sidebar section

#### Scenario: Superadmin uses the footer auxiliary route

- **WHEN** the operator needs global administration
- **THEN** they enter `/admin` from the footer superadmin affordance
- **THEN** the application does not add a sixth primary destination for that workflow

#### Scenario: Auth bootstrap helper does not become a destination card

- **WHEN** the operator has not yet bound a root key
- **THEN** the shell keeps the helper state inside the auxiliary superadmin affordance
- **THEN** the shell does not render an extra auth/bootstrap card in the main navigation surface

#### Scenario: Selected workbench owns local chrome

- **WHEN** the operator switches to a primary destination
- **THEN** the selected workbench renders its own title, metadata, and local actions inside its window chrome
- **THEN** there is no redundant global top bar or manual refresh button rendered above that workbench

#### Scenario: Compact workbench tabs do not widen the page

- **WHEN** the operator opens a multi-tab workbench on an iPhone 14-sized viewport
- **THEN** horizontal tab overflow stays inside the shared tab-strip scroller
- **THEN** `document.body` width remains constrained to the viewport instead of expanding to the tab content width

### Requirement: Compact app shell SHALL keep the left window-switcher rail visible

The top-level WebUI shell SHALL keep the left application sidebar visible on compact viewports as the persistent window switcher. Compact layouts MAY collapse that rail to icon width, but SHALL NOT hide primary navigation behind a drawer or page-local reopen control.

#### Scenario: Mobile shell keeps the window switcher visible

- **WHEN** the operator opens the WebUI on an iPhone 14-sized viewport
- **THEN** the left rail still renders the primary `Avatars`, `Skills`, `Messages`, `Workspaces`, and `Terminals` navigation surface
- **THEN** the shell does not require a page-local toolbar button to reopen primary navigation

#### Scenario: Compact rail can expand from sidebar chrome

- **WHEN** the compact app shell starts in collapsed icon mode
- **THEN** the operator can expand or collapse the same left rail from controls inside sidebar chrome
- **THEN** the current workbench window stays responsible only for page-local chrome
