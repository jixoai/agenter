## Requirements

### Requirement: Plugin/runtime source contracts SHALL distinguish lookup hints from attention payload facts
LoopBus plugin contracts SHALL treat source lookup hints as adapter-internal addressing only. Any fact that must survive into durable attention or model payloads SHALL be promoted into typed draft fields before commit serialization.

#### Scenario: Deferred source refs do not become hidden model state
- **WHEN** a plugin invalidates a source ref and the runtime reads it in a later eligible round
- **THEN** any AI-relevant detail required by that source is emitted through typed draft fields or commit body content
- **AND** the runtime does not rely on a generic source-ref metadata bag as hidden model state
