## ADDED Requirements

### Requirement: Settings resolution SHALL return field-level cascade provenance
The settings resolution engine SHALL return a provenance map keyed by JSON Pointer, where each pointer contains an ordered chain of applied origins from lowest to highest precedence.

#### Scenario: Effective pointer exposes full chain
- **WHEN** a client resolves settings graph for a scope
- **THEN** each effective pointer that has a value includes a provenance chain with at least one origin node
- **THEN** the final node in that chain represents the currently effective origin for that pointer

### Requirement: Provenance SHALL distinguish file and derived origins
The provenance model SHALL explicitly encode whether an origin is from a file layer or a derived transform layer.

#### Scenario: Derived normalization appears in chain
- **WHEN** a post-merge transform rewrites an existing pointer value
- **THEN** the pointer chain includes a derived origin node after the file origin node
- **THEN** the chain preserves ordering so clients can inspect both the source value and the transformed value

### Requirement: Settings graph SHALL include schema metadata for view rendering
The settings graph SHALL include JSON Schema generated from the authoritative zod settings schema.

#### Scenario: Scope graph includes schema payload
- **WHEN** a client requests settings graph for workspace or global scope
- **THEN** the response includes JSON Schema for effective settings fields
- **THEN** the schema is suitable for core type rendering (`object`, `array`, scalar, enum, record)
