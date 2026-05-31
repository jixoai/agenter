## MODIFIED Requirements

### Requirement: Sent-message resources SHALL project from source Markdown inside the bubble

Sent-message resource presentation SHALL be driven from the same serialized source Markdown that feeds source inspection. WebChat resource footnote definitions SHALL be the canonical storage syntax for app-view-authored image, file, video, and comment resource references; backend metadata sidecars such as `webChatCommentResources` SHALL NOT be required or consulted as sent-resource truth. Resource definition lines SHALL not remain visible as raw footnotes in the transcript, and sent-state resources SHALL not be rendered by a sibling strip outside the message bubble.

#### Scenario: Resource definitions collapse into an in-bubble aggregated bar

- **WHEN** a message source contains resource footnote definitions for image, file, video, or comment resources
- **THEN** the transcript hides the raw definition lines in preview mode
- **AND** the message bubble renders one in-bubble aggregated resource bar from those definitions
- **AND** the resource bar remains part of the CodeMirror-backed message projection
- **AND** the projection does not depend on `metadata.webChatCommentResources`

#### Scenario: Inline resource references stay lightweight in the visible body

- **WHEN** the visible message body contains `[^Resource N]` or `[^Comment N]` references
- **THEN** the transcript renders lightweight interactive inline tokens instead of raw bracket syntax
- **AND** the message body stays compact without embedding large media cards inline
- **AND** token resolution uses the matching Markdown footnote definition as source truth

#### Scenario: Raw source remains complete after projection hides footnotes

- **WHEN** the operator inspects or copies the raw message source for a sent message with resource references
- **THEN** the raw source still contains both the inline token and its Markdown footnote definition
- **AND** hiding footnote definition lines in preview mode remains a view projection rather than a storage mutation
