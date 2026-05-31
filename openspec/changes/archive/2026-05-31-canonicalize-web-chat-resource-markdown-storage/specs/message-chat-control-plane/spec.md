## ADDED Requirements

### Requirement: Room message writes SHALL keep WebChat resource projections out of backend metadata

The global room message control plane SHALL treat the room message `content` string as the only durable carrier for WebChat-authored resource-reference text. Backend message metadata SHALL remain reserved for platform-owned facts such as idempotency, lifecycle, transport, or other explicitly specified control-plane facts. WebChat frontend projection payloads such as `webChatCommentResources`, `webChatResourceReferences`, or equivalent app-view resource sidecars MUST NOT be persisted into room message metadata. Comment, image, file, and video resource references that need to survive reload or reach runtime/AI ingress MUST be represented in the raw Markdown `content` using WebChat-owned footnote syntax, while room-owned uploaded asset attachments MAY continue to persist through the separate attachment-reference contract.

#### Scenario: WebChat comment send persists Markdown content only

- **WHEN** an authorized WebChat app-view caller sends a room message containing a comment resource
- **THEN** the stored room message `content` includes the inline comment reference and its Markdown footnote definition
- **AND** the stored room message metadata does not contain `webChatCommentResources` or an equivalent WebChat resource sidecar
- **AND** later runtime and AI message ingress can read the comment body from `message.content` without consulting metadata

#### Scenario: Backend strips forbidden WebChat resource metadata at the room write boundary

- **WHEN** a browser or app-view caller submits room message metadata containing `webChatCommentResources` or another WebChat resource-projection key
- **THEN** the backend does not persist that key into the durable room message metadata
- **AND** the response, snapshot, page read, and incremental transport payloads do not expose that key as room truth
- **AND** missing Markdown resource definitions are treated as caller serialization failure rather than repaired by preserving hidden metadata

#### Scenario: Legacy polluted room rows are repaired into Markdown source

- **GIVEN** an existing durable room message stores an inline resource token in `content` and the matching comment body in `metadata.webChatCommentResources`
- **WHEN** the legacy repair path runs for that room database
- **THEN** the message `content` is rewritten to include the canonical Markdown footnote definition for the comment resource
- **AND** `metadata.webChatCommentResources` is removed from the durable metadata
- **AND** re-running the repair path does not duplicate footnote definitions or reintroduce frontend projection metadata
