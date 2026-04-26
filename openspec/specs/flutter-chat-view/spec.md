# flutter-chat-view Specification

## Purpose
Define the durable Flutter-side room chat contract for Agenter, including canonical room transport compatibility, transcript merge law, attachment upload orchestration, and explicit composer extension boundaries.

## Requirements

### Requirement: Flutter chat view SHALL match the canonical room transport contract
The Flutter chat-view package SHALL expose a real renderer-neutral contract that stays compatible with the canonical room-first message system. Its public controller, model, and package docs SHALL use the authorized room websocket endpoint `ws(s)://HOST/room/<chatId>?token=...`, SHALL accept server events `snapshot`, `messages`, `page`, `focus`, and `error`, SHALL send client actions `send`, `edit`, `recall`, `page`, and `focus`, and SHALL keep room asset upload as the separate HTTP flow `POST /api/rooms/{chatId}/assets` with `x-agenter-room-access-token`.

The controller SHALL act as the stage state kernel and SHALL consume package-owned transport, upload, and protocol codec boundaries instead of coupling feature code directly to websocket or HTTP implementations. Default package adapters SHALL preserve canonical websocket and upload behavior for hosts that only provide `transportUrl` and `accessToken`.

#### Scenario: Flutter implementation starts from the package contract
- **WHEN** a future engineer starts the next Flutter milestone
- **THEN** `packages/flutter-chat-view` already exposes the canonical room transport and upload contract
- **THEN** they do not need to reverse-engineer `packages/webui` to discover websocket paths or upload headers

#### Scenario: Controller derives room identity and upload base from transport URL
- **WHEN** the host provides a room websocket URL and an optional overriding access token
- **THEN** the controller resolves the final websocket URL with the correct `token` query
- **THEN** it derives the HTTP base URL and room id from that same transport URL

#### Scenario: Controller delegates IO through injected platform boundaries
- **WHEN** a host or test creates a controller with room transport and asset upload adapters
- **THEN** the controller delegates websocket frames and asset uploads through those adapters
- **THEN** observable room chat state remains equivalent to the default canonical adapters

#### Scenario: Malformed transport payload is isolated in the protocol codec
- **WHEN** an incoming websocket frame is malformed or has an unsupported event type
- **THEN** protocol decoding fails inside the package codec boundary
- **THEN** widget and host-shell code do not need bespoke malformed-frame handling

### Requirement: Flutter chat view SHALL merge room history and revisions by durable message identity
The Flutter chat view SHALL build one transcript from room snapshots, incremental message upserts, and reverse-time page reads without duplicating durable rows. When a room message reappears with the same durable `messageId`, the package SHALL update the existing transcript identity instead of appending a duplicate row. Recalled room messages SHALL render an objective recalled state instead of stale pre-recall body text.

#### Scenario: Later room revisions update the existing transcript row
- **WHEN** the controller receives `snapshot`, `messages`, or `page` payloads containing the same durable `messageId`
- **THEN** the transcript keeps one stable visible row for that durable message
- **THEN** the newer revision replaces the older visible content for that row

#### Scenario: Recalled room message stays objective after merge
- **WHEN** a later room upsert marks an existing durable message as recalled
- **THEN** the transcript keeps that message in place with the same durable identity
- **THEN** the visible row no longer renders the stale pre-recall body as active content

### Requirement: Flutter chat view SHALL upload attachments before sending room messages
When the operator sends pending attachments, the Flutter chat view SHALL upload those files to the canonical room asset API before emitting the websocket `send` frame. The websocket send payload SHALL reference the server-returned attachment metadata instead of raw local files. Attachment upload SHALL require a non-empty room access token.

#### Scenario: Authenticated attachment send uploads first and then sends metadata
- **WHEN** the operator sends a draft with one or more pending files and a valid room access token
- **THEN** the controller first uploads those files to `POST /api/rooms/{chatId}/assets`
- **THEN** it sends the websocket `send` frame with the returned room attachment metadata

#### Scenario: Attachment upload is unavailable without room token
- **WHEN** the host configures the chat view without a room access token
- **THEN** the composer does not advertise attachment send as available
- **THEN** the controller rejects room asset upload instead of attempting an unauthorized request

### Requirement: Flutter chat view SHALL expose composer extensions through explicit trigger plugins
The Flutter chat view SHALL keep composer extensions orthogonal to the core composer by resolving trigger-driven suggestions through explicit plugin contracts. Plugins SHALL declare their trigger character and suggestion resolution surface, and the composer SHALL discover tokens from the current cursor instead of hard-coding mentions, commands, or skills into the base widget.

#### Scenario: Composer resolves suggestions for the active trigger token
- **WHEN** the cursor sits on a token beginning with a registered trigger such as `@`, `/`, or `$`
- **THEN** the composer asks only the matching plugin for suggestions
- **THEN** selecting a suggestion replaces the active token range in the draft

#### Scenario: Plain text input does not invoke plugin suggestions
- **WHEN** the cursor is inside plain text that does not begin with a registered trigger
- **THEN** the composer does not emit an active plugin token
- **THEN** the base draft input remains a normal text composer

### Requirement: Flutter chat view SHALL compose as a host-owned conversation stage
The Flutter chat package SHALL expose chat-stage primitives that a host-owned product shell can compose without inheriting route chrome, connection forms, or app-level navigation from the package itself. The package SHALL keep room transport, transcript, composer, and row affordances inside the stage boundary while leaving profile management, shell navigation, and room-detail orchestration to the host shell.

#### Scenario: Host shell owns product chrome around the chat stage
- **WHEN** a standalone Flutter app shell embeds the chat stage
- **THEN** the package provides the conversation viewport and composer surface without forcing a second package-owned page header
- **THEN** the host shell remains free to place its own navigation, status chrome, and detail surfaces around that stage

### Requirement: Flutter chat view SHALL keep product-shell copy and adaptive navigation localizable and accessible
The Flutter chat package and its standalone Web product shell SHALL expose durable UI copy through localization delegates, SHALL keep translated copy out of controller/model truth, and SHALL provide baseline Web accessibility via semantics, keyboard reachability, and an adaptive shell that preserves the same capabilities across compact, standard, and expanded layouts.

The standalone product shell SHALL use Apple platform primitives for app-level chrome, conversation content, inspector, icon actions, action sheets, pushed pages, and content-unavailable states. Product code SHALL not hand-roll page-level Apple materials from raw background, clipping, and border values.

Compact active conversation routing SHALL be conversation-first: the transcript and composer SHALL own the chat screen, and persistent bottom app navigation SHALL NOT appear on the active compact chat page. Profiles, room facts, participants, and selected-message facts SHALL remain reachable through explicit secondary or tertiary navigation surfaces instead of peer bottom tabs.

Compact secondary and tertiary route surfaces SHALL use semantic sheet detents owned by the host-shell sheet primitive. Profile directory surfaces SHALL use a large page-style detent. Room and selected-message inspector surfaces SHALL use an inspector detent that remains clearly intentional, scrollable, and safe-area aware. Feature code SHALL select the semantic detent, not raw popup heights.

Icon-only product-shell actions SHALL expose exactly one labeled semantic button while preserving at least a 44pt hit target. Those icon-only actions SHALL also expose visible tooltip or long-press help derived from the same localized label without creating a duplicate semantic button.

#### Scenario: Product shell adapts without losing profile, conversation, or details access
- **WHEN** the host shell renders under compact, standard, or expanded width bands
- **THEN** the operator can still reach profiles, the active conversation, room facts, participants, and selected-message facts in each band
- **THEN** those layout differences remain host-shell projections instead of package-level special cases

#### Scenario: Compact active chat reserves the bottom edge for composer
- **WHEN** the host shell renders the active conversation in compact width
- **THEN** the page does not render persistent bottom navigation for profiles/details
- **THEN** the transcript and composer remain the primary bottom-edge interaction path

#### Scenario: Compact route sheets use semantic detents
- **WHEN** the operator opens compact profile directory, room inspector, or selected-message inspector
- **THEN** the host shell presents the surface through `CompactRouteSheet` using a semantic detent
- **THEN** feature code does not pass ad-hoc raw heights to the sheet

#### Scenario: Compact profile directory is a secondary route surface
- **WHEN** the operator needs to switch, create, edit, delete, or import profiles in compact width
- **THEN** the shell exposes the profile directory through an explicit leading navigation action, pushed page, or modal sheet
- **THEN** activating a profile returns the operator to the conversation route without losing active draft, transcript, or selection state

#### Scenario: Compact room and message details are inspector surfaces
- **WHEN** the operator opens room details or selects a transcript message in compact width
- **THEN** the shell presents room facts, participants, or selected-message facts through an inspector route or sheet
- **THEN** dismissing that inspector returns to the active conversation without replacing the chat stage

#### Scenario: Standard and expanded layouts project the same route law
- **WHEN** the host shell renders under standard or expanded width bands
- **THEN** it may expose profile and inspector atoms as persistent rails when space allows
- **THEN** those persistent rails remain projections of the same route-depth model used by compact layout

#### Scenario: Product shell uses Apple semantic surfaces
- **WHEN** the product shell renders profile, conversation, inspector, or empty-state UI
- **THEN** those surfaces are composed through Apple platform primitives
- **THEN** icon-only actions preserve a 44pt hit target and one localized accessibility label

#### Scenario: Icon-only action exposes help without duplicate semantics
- **WHEN** the product shell renders an icon-only action
- **THEN** the action has a localized semantic button label
- **THEN** the action exposes tooltip or long-press help from that same label
- **THEN** the tooltip does not create a second semantic button

#### Scenario: Recalled and empty-state copy is translated in the widget layer
- **WHEN** the UI needs recalled-state, retry, or empty transcript copy
- **THEN** the rendered text comes from localization delegates
- **THEN** the controller and durable room models continue to store objective facts instead of translated strings

### Requirement: Flutter chat view SHALL expose product-grade transcript affordances
The Flutter chat stage SHALL render a conversation-first transcript with restrained time dividers, message selection, and a return-to-latest affordance so a host shell can deliver long-lived room browsing without reverting to demo-style flat rendering.

Transcript and Web demo shell surfaces SHALL avoid `SelectableRegion`, `HtmlElementView`, and Flutter Web platform views. Text copy SHALL be exposed through stable message actions so virtualized rows and return-to-latest motion do not leave platform-view layout callbacks attached to disposed render objects.

When entering a non-empty room transcript, the stage SHALL initially anchor the viewport to the latest message at the bottom. While the operator remains near the latest edge, incoming messages SHALL keep the viewport near latest. When the operator scrolls near the top and older history is available, the stage SHALL request the next reverse page through the controller and preserve the visible anchor after older messages are prepended.

#### Scenario: Transcript shows restrained time dividers
- **WHEN** adjacent room messages cross a meaningful time or date boundary
- **THEN** the chat stage inserts a visually secondary time divider into the transcript
- **THEN** the divider does not dominate the message reading order

#### Scenario: Transcript opens at latest
- **WHEN** the chat stage first renders a non-empty transcript
- **THEN** the viewport is anchored to the newest message edge
- **THEN** the operator sees the latest room messages without manually tapping "Latest"

#### Scenario: Upward scrolling loads older history
- **WHEN** the transcript has `hasMoreBefore` and the operator scrolls near the top
- **THEN** the stage requests an older page through the canonical `page` action
- **THEN** it does not emit repeated page requests while an older page is already loading

#### Scenario: Older history preserves the visible anchor
- **WHEN** older messages are merged above the currently visible transcript content
- **THEN** the viewport adjusts by the inserted extent
- **THEN** the operator does not lose their current reading position

#### Scenario: Operator can recover latest after browsing older history
- **WHEN** the operator scrolls away from the newest transcript edge
- **THEN** the stage exposes a return-to-latest affordance
- **THEN** activating that affordance brings the operator back to the newest visible room messages

#### Scenario: Return-to-latest avoids Web platform-view assertions
- **WHEN** the operator scrolls a Flutter Web WASM transcript and activates return-to-latest
- **THEN** the page contains no Flutter Web platform view for message selection
- **THEN** no `_PlatformViewPlaceholderBox` or detached render-object assertion is emitted

#### Scenario: Host can project selected message detail
- **WHEN** the operator selects a transcript row
- **THEN** the chat stage exposes that selected message through an explicit callback or selection surface
- **THEN** the host shell can render message-local detail without replacing the transcript renderer
