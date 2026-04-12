## Requirements

### Requirement: Typed egress descriptors SHALL drive external routing
The runtime SHALL route committed attention outcomes through typed egress descriptors attached to the attention commit, not through free-form metadata fields.

#### Scenario: Message reply routing no longer depends on metadata
- **WHEN** a committed attention item should be dispatched as a room reply
- **THEN** the runtime reads the target from a typed message egress descriptor
- **AND** message delivery does not depend on `meta.replyTarget`
