## MODIFIED Requirements

### Requirement: Global room ids SHALL be principal ids

New global rooms SHALL be allocated from managed room principals, and the control plane SHALL reject legacy non-principal room ids for new durable room writes.

#### Scenario: New room write rejects legacy `room-*` ids
- **WHEN** a caller attempts to create a new room with a legacy synthetic id such as `room-main-*` or `room-team`
- **THEN** the write is rejected instead of creating new durable room truth under that legacy id
- **AND** only lowercase `0x...` principal ids remain valid for new room creation

#### Scenario: Breaking schema reset removes legacy room durability
- **WHEN** message durability is opened after the principal-only room-id migration
- **THEN** older durable rows that may still contain legacy `room-*` room ids are cleared by the breaking reset
- **AND** new durability created after that reset stores only principal-backed room ids
