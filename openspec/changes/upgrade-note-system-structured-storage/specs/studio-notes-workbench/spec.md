## ADDED Requirements

### Requirement: Notes workbench SHALL expose structured tags references and query views

The Studio Notes workbench SHALL present NoteSystem's structured metadata without importing note-system internals. The route SHALL show stable page identity, MIME, tags, reference edges, and query results through client runtime-store facades. SQL query entry, when present, SHALL be clearly read-only and bounded to NoteSystem views.

#### Scenario: Page detail shows structured metadata

- **WHEN** the operator opens a note page detail
- **THEN** the detail shows notebook, section, page, stable IDs, MIME, tags, references, created time, and updated time
- **AND** markdown body or content preview is rendered according to MIME capability

#### Scenario: Tag browsing filters pages

- **WHEN** the operator selects a notebook or section tag
- **THEN** the workbench shows pages matching that tag scope
- **AND** the route does not recompute tags by scanning raw files

#### Scenario: References are inspectable after rename

- **GIVEN** page A references page B
- **WHEN** page B has been renamed
- **THEN** Studio shows the reference using the current page label
- **AND** it preserves the stable target identity in the backend projection

#### Scenario: SQL query is read-only

- **WHEN** the operator submits a read-only SQL query over note views
- **THEN** the workbench shows returned rows
- **AND** mutating SQL errors are displayed as bounded NoteSystem errors

## MODIFIED Requirements

### Requirement: Notes workbench SHALL browse notebook section page facts

The Notes workbench SHALL present NoteSystem's notebook -> section -> page hierarchy with readable page detail. Page detail SHALL show stable IDs, tags, references, MIME metadata, markdown body or MIME-appropriate content preview, and source artifact metadata without requiring raw file access from Studio.

#### Scenario: Notebook and section browsing

- **GIVEN** notes exist in notebooks `ideas` and `_draft`
- **WHEN** the operator opens `/notes`
- **THEN** the route shows notebook and section groupings
- **AND** selecting a page opens its body/content descriptor and structured metadata in the detail surface

#### Scenario: Search opens a matching page

- **WHEN** the operator searches notes for a term or tag
- **THEN** matching pages show stable IDs, notebook, section, page, snippet, score, tags, and reference metadata
- **AND** selecting a result opens the same page detail contract as normal browsing

### Requirement: Notes workbench SHALL have responsive BDD coverage

The Notes route SHALL include BDD-style coverage for app-shell navigation, capability empty state, catalog browsing, search, tags, references, page detail, read-only SQL query, and desktop/mobile layout behavior.

#### Scenario: Route smoke covers desktop and mobile

- **WHEN** route-level Notes smoke acceptance runs
- **THEN** `/notes` is reachable on desktop
- **AND** `/notes` is reachable through compact navigation on the iPhone 14 viewport
- **AND** the main notes list-detail workflow remains usable without overlapping controls

#### Scenario: Component contracts cover note states

- **WHEN** Notes workbench unit or Storybook DOM tests run
- **THEN** they cover no-capability, empty notes, populated catalog, search results, selected page, tags, references, and SQL query states
- **AND** assertions target visible behavior rather than private component state

## REMOVED Requirements

## RENAMED Requirements
