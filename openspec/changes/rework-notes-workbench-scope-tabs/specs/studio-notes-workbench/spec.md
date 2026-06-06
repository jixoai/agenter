## ADDED Requirements

### Requirement: Notes workbench SHALL scope each dynamic tab to one avatar

The Notes workbench SHALL model avatar selection as workbench tab state. A dedicated Notes avatar tab MUST be keyed by exactly one avatar nickname and MUST NOT expose an avatar or role selector inside that tab body. Workspace/source roots MAY be shown as groups, filters, or metadata inside the selected avatar tab, but workspace selection MUST NOT change the tab's avatar identity.

#### Scenario: Opening an avatar creates one avatar-scoped notes tab

- **GIVEN** the operator is viewing the Notes workbench
- **WHEN** the operator opens avatar `default`
- **THEN** the workbench opens a dynamic Notes tab keyed as `notes-avatar:default`
- **AND** that tab title and toolbar identity show avatar `default`
- **AND** the tab body does not render an avatar selector

#### Scenario: Workspace facts stay inside the selected avatar scope

- **GIVEN** avatar `default` has notes from one or more readable source roots
- **WHEN** the operator views the `default` Notes tab
- **THEN** source roots and workspace-derived labels appear only as metadata, grouping, or filters inside that tab
- **AND** selecting a workspace/source grouping does not switch the avatar or mutate the workbench tab identity

#### Scenario: Closing an avatar notes tab removes only local tab presence

- **WHEN** the operator closes a dedicated Notes avatar tab
- **THEN** the current device removes only that open-tab projection
- **AND** the avatar, NoteSystem pages, source roots, and NoteSystem indexes remain durable and reopenable

### Requirement: Notes avatar tab SHALL use page-toolbar tabs for local modes

The Notes avatar tab SHALL expose local Notes modes through the shared `WorkbenchPageToolbar` page-tabs region. The avatar tab MUST provide `Browse`, `Search`, and read-only `Query` modes as dedicated page-toolbar tabs. SQL MUST NOT appear as a mixed inline form inside `Browse` or `Search`.

#### Scenario: Browse and Search are separate page-toolbar modes

- **GIVEN** the operator is viewing a Notes avatar tab
- **WHEN** the page toolbar renders local Notes navigation
- **THEN** it includes separate `Browse` and `Search` page-tabs
- **AND** switching from `Browse` to `Search` changes the mode inside the same avatar tab
- **AND** the avatar tab identity remains unchanged

#### Scenario: Search owns a full search surface

- **GIVEN** the operator switches to the `Search` mode for avatar `default`
- **WHEN** the search surface renders
- **THEN** it shows query entry, tag filters, result count/state, and result selection in a dedicated search layout
- **AND** it does not embed catalog browsing as the primary content
- **AND** it does not expose an avatar selector

#### Scenario: Query stays read-only and mode-scoped

- **GIVEN** read-only SQL is available in the Notes workbench
- **WHEN** the operator opens `Query`
- **THEN** the query surface clearly labels itself read-only
- **AND** query execution remains scoped to the selected avatar tab
- **AND** mutating SQL errors remain bounded NoteSystem errors

### Requirement: Notes route URLs SHALL encode avatar and mode scope

The Notes workbench SHALL encode avatar scope and local mode in canonical routes so browser navigation, reload, and tab restoration preserve the operator's current scope. Legacy `/notes?avatar=<nickname>` links SHALL canonicalize into the new avatar route without keeping a second durable spelling alive.

#### Scenario: Canonical avatar routes restore tab and mode

- **WHEN** the operator opens `/notes/avatar/default/search`
- **THEN** the Notes workbench opens or selects the `default` avatar tab
- **AND** the `Search` page-toolbar tab is active
- **AND** the body renders the avatar-scoped search surface

#### Scenario: Legacy avatar query canonicalizes

- **WHEN** the operator opens `/notes?avatar=default`
- **THEN** Studio redirects or replaces history to the canonical `default` Notes avatar route
- **AND** no body-level avatar selector is required to preserve that state

## MODIFIED Requirements

### Requirement: Studio SHALL expose Notes as a primary system workbench

Studio SHALL expose a primary app-shell navigation item named `Notes` that opens `/notes`. The Notes route SHALL consume runtime/client-sdk NoteSystem contracts and SHALL NOT import app-server host internals or `@agenter/note-system` implementation internals. `/notes` SHALL be the fixed Notes workbench overview or entry tab; avatar-specific note browsing SHALL live under nested avatar routes such as `/notes/avatar/[avatarNickname]`.

#### Scenario: Notes route is reachable from app shell

- **WHEN** the operator opens Studio navigation
- **THEN** the primary Systems navigation includes `Notes`
- **AND** activating it opens `/notes`
- **AND** the active navigation state follows `/notes` and nested Notes routes

#### Scenario: Notes route stays inside Studio boundary

- **WHEN** reviewers inspect the Notes route and feature source
- **THEN** it imports note data through Studio app controller and client runtime-store facades
- **AND** it does not import `@agenter/note-system` implementation files, `packages/app-server/src/*` runtime internals, or raw note artifact files

#### Scenario: Notes overview opens avatar-scoped tabs

- **WHEN** the operator opens `/notes`
- **THEN** the Notes workbench renders a fixed entry surface for discovering avatars with NoteSystem capability
- **AND** opening one avatar creates or selects a dedicated avatar-scoped Notes tab

### Requirement: Notes workbench SHALL show capability state explicitly

The Notes workbench SHALL show whether the selected avatar exposes NoteSystem capability. If no readable `AVATAR_HOME` is available for that avatar, the avatar tab SHALL render an explicit no-capability state instead of an empty list that looks like successful loading. The fixed Notes overview MAY summarize capability across avatars, but page, search, tags, SQL, and detail controls SHALL be disabled or empty by the selected avatar capability state.

#### Scenario: No note capability

- **WHEN** the operator opens a Notes avatar tab and the backend reports no readable note roots for that avatar
- **THEN** the tab renders a stable no-capability notice
- **AND** note list, search, query, and page detail controls are disabled or empty by capability state

#### Scenario: Note capability available

- **WHEN** the backend reports readable note roots for the selected avatar
- **THEN** the avatar tab renders notebooks, sections, pages, search controls, tags, and query controls from that projection
- **AND** it labels the visible source as NoteSystem capability rather than project workspace ownership

### Requirement: Notes workbench SHALL browse notebook section page facts

The Notes workbench SHALL present NoteSystem's notebook -> section -> page hierarchy inside the selected avatar tab with readable page detail. Page detail SHALL show stable IDs, tags, references, MIME metadata, markdown body or MIME-appropriate content preview, and source artifact metadata without requiring raw file access from Studio.

#### Scenario: Notebook and section browsing

- **GIVEN** notes exist in notebooks `ideas` and `_draft` for avatar `default`
- **WHEN** the operator opens `/notes/avatar/default`
- **THEN** the `Browse` mode shows notebook and section groupings
- **AND** selecting a page opens its body/content descriptor and structured metadata in the detail surface

#### Scenario: Search opens a matching page

- **WHEN** the operator searches notes for a term or tag inside one avatar tab
- **THEN** matching pages show stable IDs, notebook, section, page, snippet, score, tags, and reference metadata
- **AND** selecting a result opens the same page detail contract as normal browsing
- **AND** it does not switch avatar scope

### Requirement: Notes workbench SHALL have responsive BDD coverage

The Notes route SHALL include BDD-style coverage for app-shell navigation, avatar-scoped tab opening/closing, no body-level avatar selector, capability empty state, catalog browsing, independent search mode, tags, references, page detail, read-only SQL query, and desktop/mobile layout behavior.

#### Scenario: Route smoke covers desktop and mobile

- **WHEN** route-level Notes smoke acceptance runs
- **THEN** `/notes` is reachable on desktop
- **AND** `/notes` is reachable through compact navigation on the iPhone 14 viewport
- **AND** a seeded avatar can be opened as a Notes avatar tab
- **AND** the main notes list-detail workflow remains usable without overlapping controls

#### Scenario: Component contracts cover note states

- **WHEN** Notes workbench unit or Storybook DOM tests run
- **THEN** they cover overview, avatar tab restoration, no-capability, empty notes, populated catalog, search results, selected page, tags, references, and SQL query states
- **AND** assertions target visible behavior rather than private component state

#### Scenario: Search independence is covered

- **WHEN** Notes search tests run
- **THEN** search is verified as a dedicated page-toolbar mode
- **AND** the test asserts that the search surface does not require or render a body-level avatar selector

### Requirement: Notes workbench SHALL expose structured tags references and query views

The Studio Notes workbench SHALL present NoteSystem's structured metadata without importing note-system internals. The avatar tab SHALL show stable page identity, MIME, tags, reference edges, and query results through client runtime-store facades. SQL query entry, when present, SHALL be clearly read-only, bounded to NoteSystem views, and scoped to the selected avatar tab.

#### Scenario: Page detail shows structured metadata

- **WHEN** the operator opens a note page detail inside an avatar tab
- **THEN** the detail shows notebook, section, page, stable IDs, MIME, tags, references, created time, and updated time
- **AND** markdown body or content preview is rendered according to MIME capability

#### Scenario: Tag browsing filters pages

- **WHEN** the operator selects a tag inside the selected avatar scope
- **THEN** the workbench shows pages matching that tag scope
- **AND** the route does not recompute tags by scanning raw files
- **AND** the route does not switch avatar scope

#### Scenario: References are inspectable after rename

- **GIVEN** page A references page B
- **WHEN** page B has been renamed
- **THEN** Studio shows the reference using the current page label
- **AND** it preserves the stable target identity in the backend projection

#### Scenario: SQL query is read-only

- **WHEN** the operator submits a read-only SQL query over note views in one avatar tab
- **THEN** the workbench shows returned rows
- **AND** mutating SQL errors are displayed as bounded NoteSystem errors
- **AND** the query does not read or combine another avatar's NoteSystem projection

## REMOVED Requirements

### Requirement: Body-level Notes avatar selector

**Reason**: The body-level avatar selector mixes avatar scope with catalog/search/query content state, contradicting the one-avatar-per-tab law requested for Notes.
**Migration**: Promote avatar scope into Notes workbench tabs and canonical nested routes. Legacy query links canonicalize to avatar routes.

## RENAMED Requirements
