## ADDED Requirements

### Requirement: Web chat view SHALL serialize resource references into Markdown before room send

`web-chat-view` SHALL own the frontend Markdown resource grammar for image, file, video, and comment resource references. Pending composer resources MAY exist as local frontend state before send, but the room-send boundary SHALL serialize those resources into one raw Markdown `content` string containing lightweight inline tokens plus Markdown footnote definition lines. App-view and shared package send paths MUST NOT rely on `metadata.webChatCommentResources` or any equivalent structured WebChat resource metadata for durable storage. Sent-message resource reconstruction SHALL derive from raw Markdown `content` plus the platform attachment-reference contract for uploaded assets.

#### Scenario: Comment resource send carries the body in Markdown

- **GIVEN** the operator creates a non-empty source comment and submits a room message that references it
- **WHEN** `web-chat-view` builds the room-send payload
- **THEN** the payload `content` contains the visible `[^Comment N]` token
- **AND** the same payload `content` contains a `[^Comment N]: ...` footnote definition carrying the comment body and anchor reference
- **AND** the payload metadata does not contain `webChatCommentResources`

#### Scenario: Sent resources reconstruct from pure Markdown after reload

- **GIVEN** a room snapshot contains a message whose raw `content` includes resource footnote definitions and no WebChat resource metadata
- **WHEN** the shared transcript renders that message after reload
- **THEN** inline resource tokens and the in-bubble resource shelf resolve from the Markdown content alone
- **AND** comment detail opens with the stored comment body and selected-text anchor context
- **AND** the package does not require a backend-shaped WebChat resource object to render the sent resource projection

#### Scenario: Missing Markdown definition does not fall back to hidden WebChat metadata

- **WHEN** a sent message contains an inline comment token but no matching Markdown footnote definition
- **THEN** `web-chat-view` treats the token as unresolved source text or an unresolved resource reference
- **AND** it does not recover the comment by reading `metadata.webChatCommentResources`
- **AND** the failure remains visible to tests and source inspection as a serialization bug
