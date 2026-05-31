## ADDED Requirements

### Requirement: Client runtime store SHALL expose typed NoteSystem facades

The client runtime store SHALL expose typed methods for NoteSystem catalog, page read, and search operations. Feature routes SHALL NOT instantiate their own transport clients or derive note state by reading local filesystem paths.

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
- **AND** search results preserve notebook, section, page, score, snippet, and path metadata from the backend
