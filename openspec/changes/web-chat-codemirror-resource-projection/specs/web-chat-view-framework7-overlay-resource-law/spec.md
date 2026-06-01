## MODIFIED Requirements

### Requirement: Sent-message resources SHALL project from source Markdown inside the bubble

Sent-message resource presentation SHALL be driven from the same serialized source Markdown that feeds source inspection. WebChat resource footnote definitions SHALL be the canonical storage syntax for app-view-authored image, file, video, and comment resource references; backend metadata sidecars such as `webChatCommentResources` SHALL NOT be required or consulted as sent-resource truth. Resource definition lines SHALL not remain visible as raw footnotes in the transcript, and sent-state resources SHALL not be rendered by a sibling strip outside the message bubble.

#### Scenario: Resource token widgets are shared across writable and readonly CodeMirror surfaces

- **WHEN** an inline resource token resolves in the composer or in a sent message bubble
- **THEN** both surfaces use one shared CodeMirror resource-token widget family
- **AND** the widget family renders comment, file, and image references through one shared icon-with-number visual atom
- **AND** the visual atom accepts ink/surface/border variables without requiring token, card, or bar-specific drawing forks
- **AND** the visual atom draws its visible internals as two stacked SVG layers: base icon layer plus info layer
- **AND** visual differences are mode policy differences rather than separate parsing implementations
- **AND** Framework7 resource preview activation receives the same `WebChatResourceReference` from either surface

#### Scenario: Resource bar is a no-scroll icon strip by default

- **GIVEN** a sent message bubble contains several resolved resources
- **WHEN** the in-bubble resource bar renders those resources
- **THEN** each child owns a stable icon tile size
- **AND** the bar may wrap into additional rows when space is constrained
- **AND** the bar does not show uncontrolled horizontal or vertical scrollbars in normal desktop or iPhone 14 message widths

#### Scenario: Writable composer projection does not hide editing truth

- **WHEN** the operator edits a draft containing resource tokens
- **THEN** CodeMirror decorations may make the token look like a resource affordance
- **AND** the actual Markdown token text remains the editable draft truth
- **AND** the composer does not hide footnote definition source as if it were a readonly transcript bubble
