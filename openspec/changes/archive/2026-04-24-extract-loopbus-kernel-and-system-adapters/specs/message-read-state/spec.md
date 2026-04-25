## ADDED Requirements

### Requirement: Message read truth SHALL remain independent from AI delivery truth
Message-system read-state SHALL continue to express room-view progress only. Runtime kernels, inspection surfaces, and clients MUST NOT interpret message read membership or room-level read progress as proof that AI delivery succeeded.

#### Scenario: Runtime read acknowledgement does not imply AI acceptance
- **WHEN** the acting runtime or viewer marks a room message read before the related delivery attempt has recorded an `accepted` receipt
- **THEN** message read-state advances according to message-system law
- **AND** the related delivery projection remains `pending` or `dispatching` until receipt truth exists

#### Scenario: Inspection surfaces keep read and delivery as separate facts
- **WHEN** Heartbeat or Devtools renders work for a room-backed attention item
- **THEN** message read-state remains visible only as message truth
- **AND** delivery state is rendered from dispatch and receipt facts instead of from read arrays or room progress summaries
