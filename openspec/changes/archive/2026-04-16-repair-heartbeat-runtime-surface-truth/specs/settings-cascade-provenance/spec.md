## ADDED Requirements

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
