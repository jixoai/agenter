## MODIFIED Requirements

### Requirement: Sent-message resources SHALL project from source Markdown inside the bubble

Sent-message resource presentation SHALL be driven from the same serialized source Markdown that feeds source inspection. WebChat resource footnote definitions SHALL be the canonical storage syntax for app-view-authored image, file, video, and comment resource references; backend metadata sidecars such as `webChatCommentResources` SHALL NOT be required or consulted as sent-resource truth. Resource definition lines SHALL not remain visible as raw footnotes in the transcript, and sent-state resources SHALL not be rendered by a sibling strip outside the message bubble.

#### Scenario: Resource token widgets are shared across writable and readonly CodeMirror surfaces

- **WHEN** an inline resource token resolves in the composer or in a sent message bubble
- **THEN** both surfaces use one shared CodeMirror resource-token widget family
- **AND** visual differences are mode policy differences rather than separate parsing implementations
- **AND** Framework7 resource preview activation receives the same `WebChatResourceReference` from either surface

#### Scenario: Writable composer projection does not hide editing truth

- **WHEN** the operator edits a draft containing resource tokens
- **THEN** CodeMirror decorations may make the token look like a resource affordance
- **AND** the actual Markdown token text remains the editable draft truth
- **AND** the composer does not hide footnote definition source as if it were a readonly transcript bubble
