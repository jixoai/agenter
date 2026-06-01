## ADDED Requirements

### Requirement: Client runtime store SHALL expose structured NoteSystem facades

The client runtime store SHALL expose typed methods for NoteSystem catalog, page read, search, tag catalog/query, reference inspection, SQL query, and rename/write mutation results when those mutations are surfaced to clients. Feature routes SHALL NOT instantiate their own transport clients or derive note state by reading local filesystem paths.

#### Scenario: Notes route reads structured catalog through runtime store

- **WHEN** the Studio Notes route hydrates
- **THEN** it obtains note capability and catalog data through one typed runtime-store method
- **AND** the catalog preserves stable IDs, tags, MIME, reference counts, and artifact metadata from the backend

#### Scenario: Notes route reads structured page through runtime store

- **WHEN** the operator selects one note page
- **THEN** the route reads that page through one typed runtime-store method
- **AND** the store preserves not-found, MIME, tags, references, and stable IDs without inventing fake content

#### Scenario: Notes route queries tags and SQL through runtime store

- **WHEN** the operator or AI-facing surface requests tags or a read-only SQL query
- **THEN** the store calls typed NoteSystem facades
- **AND** it returns rows or tag summaries without exposing app-server filesystem internals

## MODIFIED Requirements

### Requirement: Client runtime store SHALL expose typed NoteSystem facades

The client runtime store SHALL expose typed methods for NoteSystem catalog, page read, search, tags, references, and read-only SQL query operations. Feature routes SHALL NOT instantiate their own transport clients or derive note state by reading local filesystem paths.

#### Scenario: Notes route reads catalog through runtime store

- **WHEN** the Studio Notes route hydrates
- **THEN** it obtains note capability and catalog data through one typed runtime-store method
- **AND** the route does not construct a route-local TRPC client for that read

#### Scenario: Notes route reads page through runtime store

- **WHEN** the operator selects one note page
- **THEN** the route reads that page through one typed runtime-store method
- **AND** the store preserves the backend not-found state without inventing fake page content

#### Scenario: Notes route searches through runtime store

- **WHEN** the operator submits a note search query
- **THEN** the route calls one typed runtime-store search method
- **AND** search results preserve stable IDs, notebook, section, page, score, snippet, tags, references, MIME, and path/artifact metadata from the backend

#### Scenario: Notes route queries tag and SQL projections through runtime store

- **WHEN** the operator inspects note tags or submits a read-only note SQL query
- **THEN** the route calls typed runtime-store methods
- **AND** the response stays bounded to backend-provided NoteSystem projections

## REMOVED Requirements

## RENAMED Requirements
