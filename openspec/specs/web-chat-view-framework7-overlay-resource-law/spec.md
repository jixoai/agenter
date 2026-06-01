# web-chat-view-framework7-overlay-resource-law Specification

## Purpose
Define the durable overlay-ownership and in-bubble resource-projection law for `web-chat-view`, including official Framework7 temporary-view ownership, source-Markdown-driven sent-resource projection, and activation parity between inline tokens and aggregated resource tiles.
## Requirements
### Requirement: Framework7 temporary views SHALL be root-owned when runtime is present

When `web-chat-view` is rendered under a real Framework7 app runtime, temporary views such as message actions, source inspectors, resource previews, and comment review SHALL open through official Framework7 modal ownership instead of local absolute-position fallbacks embedded inside message bubbles or other clipped surfaces.

#### Scenario: Message actions open through an official Framework7 temporary view

- **WHEN** the operator opens message actions from a transcript row inside the Framework7 review shell
- **THEN** the visible action surface is owned by an official Framework7 temporary-view primitive
- **AND** it is mounted outside the message bubble clipping context
- **AND** the action list is fully readable on both compact and wide viewports

#### Scenario: Trigger-driven desktop message actions do not depend on inline declarative popover wrappers

- **WHEN** the operator opens message actions from the trigger button on a non-compact review-shell viewport
- **THEN** the overlay is created by a runtime-owned Framework7 modal family instance
- **AND** desktop popover geometry does not depend on a declarative popover node remaining inline under the trigger subtree
- **AND** the visible menu stays fully readable within the viewport

#### Scenario: Trigger-driven desktop message actions remain attached to the bubble layer

- **WHEN** the operator opens message actions from a wide-viewport transcript row
- **THEN** the Framework7 action popover is anchored from a bubble-owned trigger or equivalent virtual target
- **AND** the popover edge stays visually aligned with that trigger instead of drifting toward the row, shell, or viewport center
- **AND** route-level proof records the trigger and popover geometry so this alignment cannot regress silently

#### Scenario: Trigger-driven message actions preserve Framework7 motion

- **WHEN** the operator opens or closes trigger-driven message actions under a Framework7 runtime
- **THEN** the overlay keeps Framework7 default motion semantics
- **AND** the integration does not force a `not-animated` path for the canonical review shell

#### Scenario: Host-neutral fallback remains available without Framework7 runtime

- **WHEN** the shared package is rendered without a Framework7 app runtime
- **THEN** the same message actions and detail affordances still render through named fallback surfaces
- **AND** those fallbacks do not become the primary path inside the canonical review example

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

#### Scenario: Resource token widgets are shared across writable and readonly CodeMirror surfaces

- **WHEN** an inline resource token resolves in the composer or in a sent message bubble
- **THEN** both surfaces use one shared CodeMirror resource-token widget family
- **AND** the widget family renders comment, file, and image references through one shared icon-with-number visual atom
- **AND** the visual atom accepts ink/surface/border variables without requiring token, card, or bar-specific drawing forks
- **AND** the visual atom draws its visible internals as two stacked SVG layers: base icon layer plus info layer
- **AND** the base icon layer uses the official lucide resource glyphs rather than hand-drawn lookalike paths
- **AND** the stacked real SVG layers, including the lucide-generated base SVG and the local info SVG, are owned by a shared named grid area instead of absolute-position overlay stitching or anonymous grid-line coordinates
- **AND** the info SVG layer stacks above the base icon SVG layer by explicit z-index ordering
- **AND** comment, file, and image base glyphs share one opacity rule unless a future spec names a separate visual state
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

### Requirement: Resource activation SHALL be parity across token and tile

Resource detail behavior SHALL be keyed by the resolved resource itself, not by where the operator clicked it from.

#### Scenario: Token and bar tile open the same detail surface

- **WHEN** the operator opens a resource from an inline token or from the in-bubble aggregated resource bar
- **THEN** both entry points resolve the same resource id
- **AND** they open the same preview or detail surface for that resource kind

#### Scenario: Resource kind selects the official viewer family

- **WHEN** the operator opens an image, document/video, or comment resource under a Framework7 runtime
- **THEN** all resource kinds use one shared popup/page preview shell
- **AND** image/video resources render a media stage inside that shell
- **AND** document/file resources render a document-detail stage inside that shell
- **AND** comment resources render a comment-detail stage inside that shell with explicit `view / edit` continuity

#### Scenario: Source-comment editing stays inside the Framework7 sheet safe area

- **WHEN** the operator creates or edits a comment from the source Markdown layer under a Framework7 runtime
- **THEN** the edit surface is owned by the Framework7 sheet family
- **AND** the sheet keeps cancel/save actions inside the visible safe area
- **AND** the editable textarea remains visible and usable instead of being pushed below or clipped by the sheet boundary
