## Requirements

### Requirement: Attention delta payloads SHALL serialize explicit durable fields
The prompt-side attention `items` payload SHALL serialize only explicit durable fields needed by the model: provenance, scores, summary, body/change, and typed egress descriptors when present. It SHALL NOT dump raw metadata bags into the model payload.

#### Scenario: Message attention delta includes body context without raw metadata
- **WHEN** runtime serializes an unresolved message attention commit into the `items` payload
- **THEN** the payload includes explicit provenance fields plus the rendered body/change content
- **AND** it does not include a raw `meta` object copied from runtime transport state

#### Scenario: Routing intent is serialized as typed egress
- **WHEN** an unresolved attention commit carries message reply intent
- **THEN** the payload exposes that intent through an explicit typed `egress` field
- **AND** the payload does not rely on `meta.replyTarget`
