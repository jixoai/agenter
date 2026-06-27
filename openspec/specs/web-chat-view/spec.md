# web-chat-view Specification

## Purpose
Define the framework-agnostic room-backed Web chat transport contract, including websocket hydration, a reusable custom-element delivery surface, and reverse-time paging for long histories.
## Requirements
### Requirement: Web chat view SHALL connect to one chat channel over websocket
The web chat view SHALL build its runtime state from one room transport websocket plus reverse-time history paging. The shared component SHALL be shipped as a framework-agnostic custom element with a Svelte host wrapper so multiple WebUI clients can reuse the same room transport contract. The component SHALL accept explicit viewer actor context instead of inferring viewer identity from room metadata or message labels, and it SHALL expose that transport state through one conversation-first surface instead of requiring host routes to rebuild transcript chrome around it.

#### Scenario: Connect and hydrate a room
- **WHEN** the component receives an authorized room transport URL
- **THEN** it renders the initial room snapshot
- **THEN** it can load older room history without replacing newer messages

#### Scenario: Empty resolved room snapshot does not look like a hanging transport
- **WHEN** the host has already resolved the room snapshot and that snapshot contains zero messages
- **THEN** the transcript stops rendering the initial loading shell
- **THEN** the empty-state copy is shown until new messages arrive or the websocket pushes a later snapshot

#### Scenario: Shared custom element is reusable
- **WHEN** the operator WebUI mounts the shared chat view or another frontend mounts the exported custom element
- **THEN** both consumers use the same room transport contract and transcript behavior
- **THEN** the package does not require React-specific runtime dependencies to render the shared room experience

#### Scenario: Viewer perspective uses canonical actor identity
- **WHEN** the host passes an explicit viewer actor id to the shared chat view
- **THEN** the component aligns "mine vs others" from that actor identity
- **THEN** it does not guess viewer ownership from duplicate labels or unrelated room metadata

### Requirement: Web chat view SHALL keep people shell responsibilities host-owned
The shared `@agenter/web-chat-view` package SHALL remain the room transcript/composer primitive inside a larger people-aware host shell. Contact list, contact detail, source management, current actor profile, and global app navigation SHALL be host-owned responsibilities.

#### Scenario: Host owns people navigation
- **WHEN** a app shell needs Messages, Contacts, Me, contact detail, or source management pages
- **THEN** the host builds those pages outside the shared room component
- **THEN** the shared package remains mountable as the room chat child surface
- **THEN** the package does not require a host to adopt the example app shell to render one room

#### Scenario: Contact-backed mention suggestions use existing host hooks
- **WHEN** the host has durable contact records for the current viewer actor
- **THEN** the host may provide those contacts through the existing participant/mention suggestion provider surface
- **THEN** the shared composer still treats suggestions as host-provided people references rather than reading message-system contacts directly

#### Scenario: Room entry is explicit host orchestration
- **WHEN** a contact detail page opens or creates a direct room
- **THEN** the host resolves the authorized room transport URL and viewer actor context
- **THEN** the shared chat view receives the same room websocket contract it already supports
- **THEN** the package does not own source subscription or contact-request mutation APIs

### Requirement: Viewer changes SHALL replay the current visibility fact once
When the host changes `viewerActorId`, the shared chat view SHALL treat that change as a new reader identity for read-ack projection. If the component already knows the current latest visible durable message, it SHALL re-emit that same visibility fact exactly once for the new viewer and SHALL stay idle afterwards until visibility advances again. The visibility fact SHALL carry the row `viewKey` plus the durable numeric `messageId` when one exists.

#### Scenario: Viewer switch replays the current latest visible message once
- **WHEN** the host changes `viewerActorId`
- **AND** the transcript still shows the same latest visible durable message
- **THEN** the component emits one visibility callback for that message, including its `viewKey` and numeric `messageId`
- **THEN** it does not keep replaying the same message again while the viewport stays unchanged

### Requirement: Web chat view SHALL present a conversation-first shared surface
The shared room component SHALL render one durable conversation surface with transcript, notices, and composer organized as explicit primary regions. The transcript SHALL remain the dominant viewport, while metadata or helper details SHALL collapse into secondary regions without forcing hosts to duplicate the same controls around the component. The transcript/composer shell SHALL compose shared Svelte structural primitives from `@agenter/svelte-components` instead of maintaining a private layout law inside the package. The visible embedded chat geometry SHALL stay stable in host products that do not expose global Tailwind utility CSS for package internals.

#### Scenario: Transcript remains primary on compact viewports
- **WHEN** the chat component is rendered in a narrow container
- **THEN** the transcript and composer remain immediately usable without a permanently expanded side rail
- **THEN** secondary facts or helper content collapse into secondary affordances instead of shrinking the message viewport first

#### Scenario: Embedded transcript does not create visual dead zones

- **GIVEN** a host embeds the chat component inside fixed app chrome
- **WHEN** message rows contain avatars, read indicators, icons, and bubbles
- **THEN** those elements use bounded package-owned geometry
- **AND** the transcript does not create large empty zones caused by unbounded images, unbounded SVG rings, forwarded component-root classes, or unstyled utility classes
- **AND** the composer remains attached as the bottom chat action surface

#### Scenario: Desktop host can reveal richer context without replacing the shared surface
- **WHEN** the chat component is rendered in a wider operator surface
- **THEN** the host can place surrounding metadata or management controls beside the component
- **THEN** the shared component still owns the transcript/composer shell instead of requiring a second route-local transcript renderer

#### Scenario: Short histories stay top-aligned inside the shared transcript
- **WHEN** the transcript contains too few rows to overflow the visible stage
- **THEN** the shared transcript keeps those rows aligned to the start edge of the viewport
- **THEN** latest anchoring only governs follow behavior after overflow instead of bottom-floating sparse histories

#### Scenario: Chat shell reuses shared Svelte layout law
- **WHEN** the shared chat package renders its transcript shell
- **THEN** it uses `Scaffold` and `ScrollView` from `@agenter/svelte-components`
- **THEN** chat-specific visuals and transport behavior remain local to `web-chat-view`
- **THEN** the package still avoids any dependency on `@agenter/webui`

### Requirement: Web chat view SHALL expose a rich shared composer surface
The shared chat package SHALL render a responsive CodeMirror-based composer surface with attachment previews, action/status toolbars, help hints, host-driven send orchestration, and one unified completion/resource projection instead of a minimal textarea-only input. Participant suggestions, transcript-backed resource references, pending uploads, and drafted comment resources SHALL flow through the same composer completion surface rather than being split across separate draft-only and sent-only suggestion paths.

#### Scenario: Composer shows rich pending attachment state
- **WHEN** the host adds pending files, images, or screenshots to the shared composer
- **THEN** the chat package renders visible pending attachment previews before send
- **THEN** the same composer surface still owns Enter/Shift+Enter and toolbar interaction semantics

#### Scenario: Composer toolbar stays responsive
- **WHEN** the chat package is rendered in a compact or desktop container
- **THEN** the composer toolbar adapts its controls without hiding the primary send action
- **THEN** help/status hints remain available through the same shared surface

#### Scenario: Host-managed send keeps the host hint text
- **WHEN** the host supplies its own send handler for a room/chat surface
- **THEN** the shared composer renders the host-provided hint text as-is
- **THEN** transport-only copy such as `Waiting for channel transport` does not override that host-managed hint

#### Scenario: Mixed completion merges participants and resources behind @
- **WHEN** the operator types `@` in the shared composer
- **THEN** the completion surface can return participant suggestions and resource references from the same provider
- **THEN** resource references remain queryable by token label, alias, or file name instead of requiring a separate draft-only lookup

#### Scenario: Pending and drafted resources join the same live completion law
- **WHEN** the operator has pending uploads or drafted comment resources that are not yet sent
- **THEN** those resources are merged into the same live completion reference set used by the shared composer
- **THEN** `@` and `^` can resolve those pending resources before send without waiting for them to appear in transcript history

#### Scenario: Help completion opens from ASCII and fullwidth question marks
- **WHEN** the operator types `?` or `？` in the shared composer
- **THEN** the shared completion surface opens help suggestions from the same trigger/provider contract used by other completions
- **THEN** choosing a help item still applies whitespace-aware insertion
- **THEN** the canonical review route can prove that interaction without host-local fallback logic

### Requirement: Web chat view SHALL render canonical avatar and message action affordances
The shared chat package SHALL support canonical avatar/icon resolution for room and contact identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation. The package SHALL own the CSS geometry for transcript avatars, fallback initials, icon wrappers, images, message-local row controls, and read-progress indicators so that hosts can embed the component without generating package-internal Tailwind utility classes. Natural image dimensions, forwarded classes on external component roots, host utility-class availability, or Studio route chrome SHALL NOT determine transcript avatar, read-indicator, or action-affordance size. Visible message sender presentation SHALL resolve from durable sender/contact identity first and only use message `from` or access-control labels as fallback text; access-token provenance such as a trusted bootstrap grant SHALL NOT be presented as the normal human sender when a canonical sender/contact can be resolved.

#### Scenario: Host resolves canonical avatars
- **WHEN** the host or app-view room snapshot provides canonical icon or avatar URLs for the channel or participants
- **THEN** the shared message rows render those canonical avatars in transcript presentation
- **THEN** the chat package does not guess durable identity solely from visible labels

#### Scenario: Embedded avatar geometry stays package-owned

- **GIVEN** Studio embeds the Web Chat app-view room mode
- **AND** contact presentations include image or icon URLs with arbitrary natural dimensions
- **WHEN** the transcript renders message rows
- **THEN** each transcript avatar is clipped inside the shared chat avatar geometry
- **AND** the avatar bounding box stays within normal chat-row dimensions
- **AND** the host does not need a Studio-only `.message-avatar` emergency patch
- **AND** the result does not depend on the host generating Tailwind utility CSS for `@agenter/web-chat-view`

#### Scenario: Human-facing transcript identity does not leak raw contact ids by default
- **WHEN** the host resolves a participant presentation with canonical label, subtitle, and avatar facts
- **THEN** the transcript prioritizes the human-facing presentation in the visible row chrome
- **THEN** raw contact ids are not required to render as visible primary transcript text

#### Scenario: Trusted bootstrap label does not replace sender presentation
- **GIVEN** a room snapshot contains a message created through a bootstrap or admin grant
- **AND** the message has a canonical `senderContactId` or the snapshot provides a canonical presentation for the sender
- **WHEN** app-view renders the transcript
- **THEN** the visible sender label comes from the canonical sender/contact presentation
- **AND** `Trusted bootstrap` is not shown as the normal sender name
- **AND** bootstrap/admin grant labels remain access provenance rather than author identity

#### Scenario: App-view room mode receives self-sufficient actor presentation
- **WHEN** app-view runs in partial room mode inside Studio
- **THEN** it can construct or fetch an actor directory containing `actorId`, label, kind, and `iconUrl` for room senders visible in the snapshot
- **AND** the iframe does not import Studio runtime stores or depend on a Studio event bridge for normal sender/avatar presentation

#### Scenario: Shared row exposes local message actions without wrong-side compact padding
- **WHEN** the operator hovers, focuses, or context-clicks a transcript row
- **THEN** the row reveals the shared local message action affordance
- **AND** host routes can extend those actions without replacing the shared row renderer
- **AND** compact row styling does not reserve an unconditional `padding-inline-end` space that visually behaves like wrong-side padding for both sent and received bubbles
- **AND** action placement is expressed by explicit row ownership or overlay geometry rather than assuming document direction equals bubble direction

#### Scenario: Embedded read indicators stay package-owned

- **GIVEN** Studio embeds app-view and supplies read/unread contact projections for transcript messages
- **WHEN** a message row renders a discloseable read-progress trigger
- **THEN** the read indicator and its SVG ring are bounded to normal inline affordance dimensions
- **AND** the sizing rule works even when the trigger root is rendered by a Framework7 component
- **AND** the host does not need a Studio-only `.message-read-indicator` emergency patch

### Requirement: Web chat view SHALL expose a Framework7 app island for host embedding

The shared chat package SHALL distinguish the transcript/composer leaf from the whole Web Chat app surface. The whole app surface SHALL own the Framework7 `App`, `View`, and `Page messagesContent` topology, plus the app-level styles needed by Framework7 chat primitives. Host products MAY surround that island with host-specific controls, but they SHALL NOT treat the leaf `WebChatViewHost` as a complete replacement for the Framework7 page shell.

#### Scenario: Canonical review shell is the visual reference

- **GIVEN** the full `web-chat-view` review shell renders a room chat
- **WHEN** Studio embeds the Web Chat room surface
- **THEN** Studio uses the same exported Web Chat island or an explicitly documented embedded variant
- **AND** the visible chat area keeps the same Framework7 `messagesContent`, `Messages`, and `Messagebar` responsibilities

#### Scenario: Hidden runtime is not a visible page shell

- **GIVEN** `WebChatViewHost` initializes a hidden Framework7 runtime for overlays or Framework7 APIs
- **WHEN** a host mounts only `WebChatViewHost` inside a non-Framework7 layout
- **THEN** the hidden runtime SHALL NOT be considered sufficient evidence that the chat page is using the canonical Framework7 shell
- **AND** BDD evidence SHALL assert the visible page topology, not only the presence of `app.f7`

#### Scenario: Host styles do not impersonate Framework7 topology

- **WHEN** a host needs to embed the chat surface
- **THEN** it consumes the package-owned island boundary or iframe/custom-element wrapper
- **AND** it does not recreate Framework7 page/content behavior through host-local padding, clipping, or emergency CSS patches

### Requirement: Web chat view SHALL name the full app mode as app-view

The runnable full surface SHALL be referred to as `app-view` in app language. The filesystem path may remain historical, but docs, visible titles, and change artifacts SHALL treat the full `example` entrypoint as the canonical `app-view` mode so the integration contract stays clear. App-view SHALL support both standalone full-app mode and partial embedded room mode through URL-selected launch facts. Partial embedded mode SHALL be understood as an app-view mode, not as a lower-level widget API.

#### Scenario: App-view naming stays app-facing

- **WHEN** the full review shell is opened directly
- **THEN** the visible title and docs describe the surface as `app-view`
- **AND** the historical directory name does not change the app semantics

#### Scenario: App-view partial room mode behaves like a webview

- **WHEN** a host opens app-view with `mode=room`, room transport URL, viewer token, and viewer contact id
- **THEN** app-view renders a focused room chat route using its own Framework7 shell and app styles
- **AND** app-view connects to the backend/room transport itself instead of relying on host DOM callbacks
- **AND** the embedding host does not add resize or event bridges for normal transcript operation
- **AND** the backend remains the only synchronization source shared between host chrome and app-view

#### Scenario: Inline-end read indicator discloses message-local reader detail
- **WHEN** a transcript row has frozen `read` and `unread` actor projections
- **THEN** the inline-end read indicator stays compact by default
- **THEN** opening that indicator reveals the canonical `Read` and `Unread` actor lists for that specific message without adding room-header aggregate chrome

#### Scenario: Message-local read disclosure keeps a readable compact width
- **WHEN** the operator opens a message-local read disclosure on desktop or compact viewport
- **THEN** the disclosure renders as a readable card instead of collapsing to content width
- **THEN** compact layouts may collapse to one column, but they still keep the disclosure fully legible within the viewport

#### Scenario: Viewer-owned layout keeps the read trigger on the bubble edge
- **WHEN** the transcript renders a viewer-owned room message with read-progress metadata
- **THEN** the read-progress trigger stays adjacent to that bubble's inline-end edge
- **THEN** reversing viewer-owned layout does not move the trigger to the opposite side of the message

### Requirement: Web chat view SHALL render durable message revision state objectively
The shared transcript SHALL render room-message revision state from the durable message record itself instead of synthesizing extra transcript rows. The shared row lifecycle SHALL be keyed by `viewKey`, while room lifecycle updates delivered on the same durable numeric `messageId` SHALL update the existing room-backed row in place.

#### Scenario: Edited message updates the existing transcript row
- **WHEN** the transport delivers a later version of a room message with the same numeric `messageId` and a newer visible edited state
- **THEN** the transcript updates that existing row in place instead of appending a second corrective row
- **THEN** the row can expose that the message was edited from the durable record

#### Scenario: Recalled message stops rendering stale body content
- **WHEN** the transport delivers a recalled version of a room message on the same numeric `messageId`
- **THEN** the transcript renders that row as a recalled message
- **THEN** it does not keep showing the stale pre-recall body as the current message content

#### Scenario: Room pagination and hydration keep revision identity stable
- **WHEN** an edited or recalled room message appears through initial snapshot, reverse pagination, or later incremental updates
- **THEN** the shared merge logic resolves that lifecycle change through the same durable numeric `messageId`
- **THEN** the visible transcript row keeps its stable `viewKey`
- **THEN** the transcript does not duplicate the row just because the lifecycle state changed

### Requirement: Web chat view SHALL keep hybrid markdown preview source-faithful
The shared transcript SHALL keep message Markdown source in the underlying CodeMirror document while projecting structural Markdown blocks into source-owned preview overlays. GFM tables SHALL render as preview tables, fenced code SHALL use dedicated block-code chrome instead of inline-code styling, focusing a structural preview SHALL reveal the raw Markdown source without waiting for a drag selection, and structural preview code rows SHALL keep the same line-height law as raw mode instead of stretching to fill the overlay card.

#### Scenario: GFM table renders as a preview table
- **WHEN** a room message contains GitHub-flavored Markdown table syntax
- **THEN** the transcript renders that table as a preview table instead of literal pipe-delimited paragraph text
- **THEN** the table stays inside the message bubble with its own local horizontal overflow handling

#### Scenario: Fenced code keeps block-code chrome separate from inline code
- **WHEN** a room message contains fenced code with or without an explicit language label
- **THEN** the transcript renders the fenced block with block-code chrome and mono content
- **THEN** the block does not inherit inline-code capsule styling

#### Scenario: Focusing a structural preview reveals raw markdown immediately
- **WHEN** the operator focuses a projected table or fenced code block in the transcript
- **THEN** the structural preview reveals raw Markdown source from the underlying document
- **THEN** the operator does not need to start a drag selection before raw source becomes visible

#### Scenario: Non-empty structural selection soft-reveals raw markdown
- **WHEN** the operator creates a non-empty selection intersecting a projected table or fenced code block in the transcript
- **THEN** the structural preview overlay soft-reveals raw Markdown source from the underlying document
- **THEN** copying that selection preserves the raw Markdown instead of rendered preview text

#### Scenario: Structural preview keeps source-owned height budget
- **WHEN** a room message renders the same structural Markdown block in preview mode and in raw source mode
- **THEN** the block keeps the same outer flow height budget in both modes
- **THEN** the structural preview does not re-layout the transcript around a taller replacement widget

#### Scenario: Structural preview code rows keep raw line-height
- **WHEN** a fenced code block renders in preview mode
- **THEN** each preview code row uses the same line-height baseline as raw mode
- **THEN** the preview does not stretch code rows merely to fill the measured overlay height

### Requirement: Web chat view SHALL render first-class room reply previews
The shared chat transcript SHALL render room-message references as a first-class preview surface instead of relying on quote-like body text conventions. When a room message carries `ref`, the row SHALL render a compact preview of the referenced durable room message and SHALL keep that preview synchronized with the referenced message's current objective lifecycle state.

#### Scenario: Replying room message renders a compact referenced preview
- **WHEN** the transcript renders a room message whose `ref` points to another durable room message
- **THEN** the row shows a compact preview of the referenced message above or alongside the new body
- **THEN** the preview is driven from structured room message data rather than from manually embedded quote text

#### Scenario: Referenced recalled message stays objective in the preview
- **WHEN** the referenced room message has been recalled
- **THEN** the reply preview renders the recalled state instead of stale pre-recall body text
- **THEN** the referencing room row remains in place with the same `ref`

#### Scenario: Referenced message outside the visible transcript window can still preview
- **WHEN** the current transcript window contains a room message whose referenced target is not otherwise present in the visible `items`
- **THEN** the shared chat view can still render that preview from sidecar referenced message data
- **THEN** the host does not need a second route-local lookup path to make reply previews work

### Requirement: Web chat view SHALL drive transcript scrolling through named triggers and an installed program
The shared chat component SHALL delegate transcript scrolling to the shared anchored virtual list scroll contract instead of feature-local raw overflow ownership or generic `ScrollView` semantics, even when delivered as a reusable custom element. Inside host-provided `page_content`, the chat stage SHALL keep `messages_list` as the only transcript scroll owner and `message_toolbar` pinned to the stage bottom. Return-to-latest, transport append follow, older-page reveal, insert-batch affordances, and user-input interruption SHALL be driven through named trigger facts and a shared installed program rather than feature-local imperative request calls. Transcript mutation choreography such as latest follow, older reveal, insert-motion stabilization, and user-input interruption SHALL run entirely through the shared ownership-chain runtime rather than a package-local scroll state machine.

#### Scenario: Transcript uses the shared anchored virtual list scroll law
- **WHEN** the chat transcript exceeds the visible height
- **THEN** the component scrolls through the shared anchored virtual list scroll contract
- **THEN** host surfaces do not need to wrap the transcript in a second competing scroll owner

#### Scenario: Composer stays pinned while transcript scrolls
- **WHEN** the transcript grows beyond the available room stage height
- **THEN** only `messages_list` scrolls
- **THEN** the composer stays pinned at the bottom of the shared chat stage instead of entering a second page-level scroll region

#### Scenario: User input can interrupt programmatic transcript scrolling
- **WHEN** a programmatic transcript scroll is in progress
- **AND** the operator starts wheel, direct-manipulation, keyboard, or momentum-driven scrolling
- **THEN** transcript ownership follows the shared anchored virtual list interruption rules
- **AND** the component does not keep a private route-local scroll conflict state machine

#### Scenario: Return-to-latest is an action trigger, not a direct request call
- **WHEN** the operator activates the transcript's `Scroll to latest` affordance
- **THEN** the chat surface raises an action trigger that the installed scroll program consumes
- **AND** the feature code does not directly call the old request surface for that action

#### Scenario: Scroll to latest returns to the latest edge on the real review route
- **WHEN** the operator is away from latest on the real review route and activates `Scroll to latest`
- **THEN** the installed trigger program pins the transcript to the latest edge
- **AND** the interaction does not seek history start or otherwise move in the wrong direction
- **AND** the affordance behavior is verified from route-level evidence, not only DOM-local mutation

#### Scenario: Top-aligned underflow preserves bottom-anchored overflow physics
- **WHEN** the transcript requests start-edge alignment for sparse underflow
- **THEN** the shared anchored timeline keeps its reverse-flow viewport and content coordinate system
- **AND** the underflow option changes only packing/alignment inside the shared primitive
- **AND** `Scroll to latest` still pins the latest row to the visible bottom edge after the transcript overflows

#### Scenario: Transport append while pinned follows latest through the installed program
- **WHEN** newer room messages arrive while the transcript is effectively at latest
- **THEN** the named trigger program follows latest through the shared tx runtime
- **AND** the transcript does not rely on route-local `scrollTop` bookkeeping

#### Scenario: Older-page reveal is triggered from named query facts
- **WHEN** older history is prepended while the operator is near history start
- **THEN** the installed program derives reveal behavior from named query facts such as collection delta and edge state
- **AND** the component does not keep a second feature-local scroll ownership path

#### Scenario: Return-to-latest interrupted by wheel keeps the transcript away
- **WHEN** the operator is away from latest and triggers the shared `scrollToLatest` affordance
- **AND** wheel input starts before that semantic request completes
- **THEN** the transcript stays away from latest under user ownership
- **AND** the latest affordance remains visible instead of being hidden by a competing private scroll writer

#### Scenario: Latest follow and older reveal do not rely on private viewport writes
- **WHEN** room messages are appended or older pages are prepended
- **THEN** the component contributes mutation facts to the shared transaction runtime
- **AND** package-local render hooks do not issue their own `scrollTo`, `scrollTop`, or equivalent viewport writes

### Requirement: Web chat view SHALL support large chat histories
The web chat view SHALL use virtualized rendering and reverse-time pagination for long-lived room conversations.

#### Scenario: Years of room history remain navigable
- **WHEN** the room has a long history
- **THEN** the viewport only renders the visible message window
- **THEN** older history is loaded by time-based reverse pagination

### Requirement: Web chat view SHALL separate view identity from durable message identity
The shared chat package SHALL use `viewKey` as the UI merge and render identity for transcript rows. Durable room truth SHALL remain explicit as a separate numeric `messageId` field when the message originates from room transport.

#### Scenario: Room-backed message exposes both identities
- **WHEN** the host maps a durable room message into the shared chat view
- **THEN** the row exposes a stable string `viewKey`
- **THEN** the same row also exposes its numeric durable `messageId`
- **THEN** the shared package does not rename the UI key back to `messageId`

#### Scenario: Local non-durable row renders without a room message id
- **WHEN** a host or test fixture creates a local transcript row that has not been assigned a durable room message id
- **THEN** the row can still render and merge through `viewKey`
- **THEN** the absence of a numeric durable `messageId` does not break the shared transcript surface

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

#### Scenario: Composer and bubble share one resource token projection law

- **GIVEN** the writable composer contains an inline resource token such as `[^Comment 1]`
- **AND** the pending resource list contains the matching comment resource
- **WHEN** the composer CodeMirror renders the draft
- **THEN** the token is decorated with the shared icon-with-number resource affordance
- **AND** the underlying draft text remains editable Markdown
- **AND** submitting still serializes the final message as raw Markdown content without WebChat resource metadata

#### Scenario: Composer resource completion is scoped to the current draft message

- **GIVEN** the transcript already contains sent messages with Markdown resource footnotes such as `[^Image 1]` and `[^File 1]`
- **AND** the current composer draft has its own pending resources
- **WHEN** the operator opens `@` or `^` completion in the composer
- **THEN** completion suggestions include only current composer resources and host-provided composer-scoped resources
- **AND** resources reconstructed from other transcript messages are not offered
- **AND** `Comment N`, `Image N`, and `File N` numbering is local to the current message rather than global across the room

#### Scenario: Composer upload opens the resource preview immediately

- **GIVEN** the composer accepts a newly uploaded image or file
- **WHEN** the pending asset is admitted into the current draft resource list
- **THEN** the same resource preview layer used by clicking the resource rail icon opens automatically for that newly accepted resource
- **AND** duplicate or rejected files do not reopen a stale preview

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

#### Scenario: Resource preview and completion copy uses reference names and file names

- **GIVEN** an image or file resource has a reference label such as `Image 1` or `File 1`
- **AND** the resource also has an extension, MIME type, and file name
- **WHEN** the preview layer renders its header
- **THEN** the header eyebrow shows the reference label instead of the extension or MIME type
- **AND** MIME and size details stay in the metadata line
- **WHEN** the composer completion panel renders that resource
- **THEN** the row label stays the reference label
- **AND** the row detail prefers the image or file name over a generic resource kind description

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
