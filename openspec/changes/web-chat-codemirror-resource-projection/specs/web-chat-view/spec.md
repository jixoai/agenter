## MODIFIED Requirements

### Requirement: Web chat view SHALL serialize resource references into Markdown before room send

`web-chat-view` SHALL own the frontend Markdown resource grammar for image, file, video, and comment resource references. Pending composer resources MAY exist as local frontend state before send, but the room-send boundary SHALL serialize those resources into one raw Markdown `content` string containing lightweight inline tokens plus Markdown footnote definition lines. App-view and shared package send paths MUST NOT rely on `metadata.webChatCommentResources` or any equivalent structured WebChat resource metadata for durable storage. Sent-message resource reconstruction SHALL derive from raw Markdown `content` plus the platform attachment-reference contract for uploaded assets.

#### Scenario: Composer and bubble share one resource token projection law

- **GIVEN** the writable composer contains an inline resource token such as `[^Comment 1]`
- **AND** the pending resource list contains the matching comment resource
- **WHEN** the composer CodeMirror renders the draft
- **THEN** the token is decorated with the shared icon-with-number resource affordance
- **AND** the underlying draft text remains editable Markdown
- **AND** submitting still serializes the final message as raw Markdown content without WebChat resource metadata

#### Scenario: Resource icon number is normalized for all token surfaces

- **GIVEN** a resource label or token text resolves to resource number `1` through `9`
- **WHEN** the composer token, readonly bubble token, or resource card renders that resource
- **THEN** the visible icon number is the resolved single digit
- **AND** a resource number outside `1` through `9` renders `*`
- **AND** comment, file, and image variants are rendered by the same icon-with-number component family

#### Scenario: Resource icon atom supports visual theming and browser-min-font-safe scaling

- **GIVEN** the shared resource icon atom is rendered with different ink and surface CSS variables
- **WHEN** image, comment, and file variants render in the walkthrough surface
- **THEN** the icon glyph, number, and extension badge remain legible across those colors
- **AND** the image glyph and image number use the same ink color
- **AND** small numeric and extension text uses `font-size: 1rem` with transform scale instead of shrinking only through `font-size`

#### Scenario: Resource icon atom draws visible marks through layered SVG

- **GIVEN** the shared resource icon atom renders a comment, file, or image variant
- **WHEN** the visible icon internals are constructed
- **THEN** the base resource glyph is drawn in a base SVG layer using the official lucide glyph for that kind
- **AND** the resource number, badge, and extension marks are drawn in a separate info SVG layer
- **AND** the two SVG layers share one stable viewBox coordinate system
- **AND** the two real SVG elements, including the lucide-generated base SVG and the local info SVG, are placed into the same named grid area by the component layout rather than stitched together with absolute positioning or anonymous grid-line coordinates
- **AND** the info SVG layer has an explicit stacking order above the base icon SVG layer
- **AND** base glyph opacity is controlled by one shared component law instead of kind-specific opacity exceptions
- **AND** token, card, preview, and resource bar surfaces do not add their own visible HTML overlays for the resource number or extension

#### Scenario: Resource icon container protects SVG layers from rounded clipping

- **GIVEN** the shared resource icon atom has a border radius and hidden overflow
- **WHEN** the base and info SVG layers render inside the icon container
- **THEN** the container provides safe padding derived from the effective corner radius
- **AND** the padding equals `min(border-radius, width, height) / 4`
- **AND** the base and info SVG layers remain same-size grid layers inside the padded content box

#### Scenario: Resource icon atom follows user-directed optical alignment

- **GIVEN** the shared resource icon atom renders image, comment, and file variants
- **WHEN** the info layer draws each variant-specific mark
- **THEN** the image number is centered inside its circular badge
- **AND** user-tuned image badge SVG coordinates and radius are preserved as component attributes
- **AND** the image number badge stroke uses currentColor with a thin `0.5` stroke width
- **AND** the comment variant uses the official `MessageSquareDot` base glyph with a smaller centered number
- **AND** the file variant offsets and scales the info layer so the file number remains centered while the extension badge sits at the bottom-right corner
- **AND** user-tuned comment/file SVG coordinates are preserved as component attributes
- **AND** the file extension badge stroke uses currentColor with a thin `0.5` stroke width
- **AND** the file extension still uses scaled `1rem` text rather than browser-minimum font-size dependency

#### Scenario: File resource icon uses extension as a badge

- **GIVEN** a file resource has a resolved extension such as `PDF`
- **WHEN** the file resource icon renders
- **THEN** the file number is centered inside the file icon
- **AND** the extension renders as a bottom-right corner badge
- **AND** inline and tile sizes share the same badge SVG coordinate law rather than applying an inline-only badge translation
- **AND** the file info SVG layer is not resized or repositioned as a whole layer
- **AND** any file-specific optical scale or offset is folded into internal SVG coordinates and text scale variables
- **AND** the extension text uses scaled `1rem` text rather than a browser-minimum font-size dependency

#### Scenario: Readonly bubble keeps sent projection semantics

- **GIVEN** a sent message contains inline resource tokens and matching Markdown footnote definitions
- **WHEN** the readonly bubble CodeMirror renders the message
- **THEN** inline tokens use the same icon-with-number resource affordance family
- **AND** footnote definition lines collapse out of normal reading mode
- **AND** the in-bubble resource bar is rendered from the same resolved resources
- **AND** the in-bubble resource bar controls child tile dimensions without uncontrolled horizontal or vertical scrollbars

### Requirement: Web chat view SHALL expose CodeMirror mode ownership for composer and transcript

The shared WebChat surface SHALL treat the composer and message bubble as two explicit CodeMirror modes over the same Markdown resource grammar. The composer mode SHALL be writable and preserve normal editing behavior. The bubble mode SHALL be readonly and may hide structural source details such as resource footnote definitions as presentation-only projection.

#### Scenario: Composer is writable CodeMirror

- **WHEN** the WebChat composer mounts in a browser runtime
- **THEN** the draft surface is a CodeMirror editor
- **AND** editing the document updates the composer draft
- **AND** the editor is not configured with readonly or non-editable CodeMirror facets

#### Scenario: Bubble is readonly CodeMirror

- **WHEN** a message bubble mounts
- **THEN** the content surface is a CodeMirror editor
- **AND** the editor is configured with readonly state and non-editable DOM behavior
- **AND** resource-token projection remains interactive for opening resource details
