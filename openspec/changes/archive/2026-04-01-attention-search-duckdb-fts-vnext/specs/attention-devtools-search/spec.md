## Purpose

Define the attention inspector search contract for query strings, validation, and result rendering.

## Requirements

### Requirement: Attention devtools SHALL persist one normalized query string

The attention inspector SHALL store its search state as one normalized query string in the route and use that same string for backend queries.

#### Scenario: Query text is normalized in route state

- **WHEN** a user enters `  score:relay01   deep:2  `
- **THEN** the route keeps a normalized query string instead of separate field bags
- **THEN** reopening the panel restores the same query semantics

### Requirement: Attention devtools SHALL expose parse diagnostics

The attention inspector SHALL show syntax diagnostics when the shared parser rejects a query.

#### Scenario: Invalid query shows a validation error

- **WHEN** a user enters an invalid query such as `"unfinished`
- **THEN** the inspector shows a parse error
- **THEN** it does not silently downgrade the query into substring search

### Requirement: Attention devtools SHALL use the shared backend query contract

The attention inspector SHALL send the normalized query string to the runtime backend instead of reconstructing a second structured filter shape.

#### Scenario: Query callback receives one query string

- **WHEN** the inspector runs a search
- **THEN** it calls the backend with `{ sessionId, query, offset?, limit? }`
- **THEN** frontend and AI tooling share the same query-language contract
