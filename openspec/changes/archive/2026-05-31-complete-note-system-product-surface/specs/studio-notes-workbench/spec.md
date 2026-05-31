## ADDED Requirements

### Requirement: Studio SHALL expose Notes as a primary system workbench

Studio SHALL expose a primary app-shell navigation item named `Notes` that opens `/notes`. The Notes route SHALL consume runtime/client-sdk NoteSystem contracts and SHALL NOT import app-server NoteSystem implementation internals.

#### Scenario: Notes route is reachable from app shell

- **WHEN** the operator opens Studio navigation
- **THEN** the primary Systems navigation includes `Notes`
- **AND** activating it opens `/notes`
- **AND** the active navigation state follows `/notes` and nested Notes routes

#### Scenario: Notes route stays inside Studio boundary

- **WHEN** reviewers inspect the Notes route and feature source
- **THEN** it imports note data through Studio app controller and client runtime-store facades
- **AND** it does not import `packages/app-server/src/note-system/*` or runtime internals

### Requirement: Notes workbench SHALL show capability state explicitly

The Notes workbench SHALL show whether the current runtime/avatar workspace group exposes NoteSystem capability. If no readable `AVATAR_HOME` is available, the route SHALL render an explicit no-capability state instead of an empty list that looks like successful loading.

#### Scenario: No note capability

- **WHEN** the operator opens `/notes` and the backend reports no readable note roots
- **THEN** the route renders a stable no-capability notice
- **AND** note list, search, and page detail controls are disabled or empty by capability state

#### Scenario: Note capability available

- **WHEN** the backend reports readable note roots
- **THEN** the route renders notebooks, sections, pages, and search controls from that projection
- **AND** it labels the visible source as NoteSystem capability rather than project workspace ownership

### Requirement: Notes workbench SHALL browse notebook section page facts

The Notes workbench SHALL present NoteSystem's notebook -> section -> page hierarchy with a readable page detail. Page detail SHALL show frontmatter metadata and Markdown body without requiring raw file access from Studio.

#### Scenario: Notebook and section browsing

- **GIVEN** notes exist in notebooks `ideas` and `_draft`
- **WHEN** the operator opens `/notes`
- **THEN** the route shows notebook and section groupings
- **AND** selecting a page opens its body and metadata in the detail surface

#### Scenario: Search opens a matching page

- **WHEN** the operator searches notes for a term
- **THEN** matching pages show notebook, section, page, snippet, and score metadata
- **AND** selecting a result opens the same page detail contract as normal browsing

### Requirement: Notes workbench SHALL have responsive BDD coverage

The Notes route SHALL include BDD-style coverage for app-shell navigation, capability empty state, catalog browsing, search, page detail, and desktop/mobile layout behavior.

#### Scenario: Route smoke covers desktop and mobile

- **WHEN** route-level Notes smoke acceptance runs
- **THEN** `/notes` is reachable on desktop
- **AND** `/notes` is reachable through compact navigation on the iPhone 14 viewport
- **AND** the main notes list-detail workflow remains usable without overlapping controls

#### Scenario: Component contracts cover note states

- **WHEN** Notes workbench unit or Storybook DOM tests run
- **THEN** they cover no-capability, empty notes, populated catalog, search results, and selected page states
- **AND** assertions target visible behavior rather than private component state
