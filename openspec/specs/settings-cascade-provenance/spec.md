# settings-cascade-provenance Specification

## Purpose
Define the field-level provenance graph and schema metadata contract for settings resolution.
## Requirements
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

### Requirement: Editable settings layers SHALL preserve source format and canonical runtime pointers

Settings editing workflows SHALL serialize updates back into the editable layer using that layer's native file format and the canonical settings pointers defined by the effective schema, instead of emitting loosely formatted text or writing runtime knobs into provider-default subtrees.

#### Scenario: JSON-backed editable layers stay valid JSON after runtime saves

- **WHEN** a runtime settings workflow saves changes into an editable `.json` settings layer
- **THEN** the persisted file remains valid JSON that the settings loader can parse without recovery logic
- **AND** the save path does not emit YAML-style text into that JSON file

#### Scenario: Runtime model knobs persist under canonical top-level ai pointers

- **WHEN** the operator saves runtime model settings such as `temperature`, `top-k`, `max tokens`, or `thinking`
- **THEN** the persisted layer writes those changes under canonical top-level pointers such as `/ai/temperature`, `/ai/topK`, `/ai/maxToken`, and `/ai/thinking`
- **AND** the save path does not mutate `ai.providers.*` defaults just to change the next runtime call

