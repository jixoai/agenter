## MODIFIED Requirements

### Requirement: Attention delta payloads SHALL serialize explicit durable fields
The prompt-side attention `items` payload SHALL serialize only explicit durable fields needed by the model: provenance, scores, summary, and body/change content. It SHALL NOT dump raw metadata bags into the model payload, and it SHALL NOT carry hidden room-routing descriptors as a substitute for explicit message tools.

#### Scenario: Message attention delta includes body context without raw metadata
- **WHEN** runtime serializes an unresolved message attention commit into the `items` payload
- **THEN** the payload includes explicit provenance fields plus the rendered body/change content
- **AND** it does not include a raw `meta` object copied from runtime transport state

#### Scenario: Room-visible intent stays explicit
- **WHEN** unresolved attention implies that a room-visible correction or reply may be needed
- **THEN** the payload leaves that decision to explicit tools such as `message send`, `message edit`, or `message recall`
- **AND** the payload does not rely on `meta.replyTarget` or any hidden routing descriptor
