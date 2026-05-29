## MODIFIED Requirements

### Requirement: Web chat view SHALL render canonical avatar and message action affordances

The shared chat package SHALL support host-provided canonical avatar/icon resolution for room and contact identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation. The package SHALL own the CSS geometry for transcript avatars, fallback initials, icon wrappers, images, message-local row controls, and read-progress indicators so that hosts can embed the component without generating package-internal Tailwind utility classes. Natural image dimensions, forwarded classes on external component roots, host utility-class availability, or Studio route chrome SHALL NOT determine transcript avatar or read-indicator size.

#### Scenario: Host resolves canonical avatars
- **WHEN** the host provides canonical icon or avatar URLs for the channel or participants
- **THEN** the shared message rows render those canonical avatars in transcript presentation
- **THEN** the chat package does not guess durable identity solely from visible labels

#### Scenario: Embedded avatar geometry stays package-owned
- **GIVEN** Studio embeds `WebChatViewHost` as a direct Svelte child with `showHeader={false}`
- **AND** contact presentations include image or icon URLs with arbitrary natural dimensions
- **WHEN** the transcript renders message rows
- **THEN** each transcript avatar is clipped inside the shared chat avatar geometry
- **AND** the avatar bounding box stays within normal chat-row dimensions
- **AND** the host does not need a Studio-only `.message-avatar` emergency patch
- **AND** the result does not depend on the host generating Tailwind utility CSS for `@agenter/web-chat-view`

#### Scenario: Embedded read indicators stay package-owned
- **GIVEN** Studio embeds `WebChatViewHost` and supplies read/unread contact projections for transcript messages
- **WHEN** a message row renders a discloseable read-progress trigger
- **THEN** the read indicator and its SVG ring are bounded to normal inline affordance dimensions
- **AND** the sizing rule works even when the trigger root is rendered by a Framework7 component
- **AND** the host does not need a Studio-only `.message-read-indicator` emergency patch

#### Scenario: Human-facing transcript identity does not leak raw contact ids by default
- **WHEN** the host resolves a participant presentation with canonical label, subtitle, and avatar facts
- **THEN** the transcript prioritizes the human-facing presentation in the visible row chrome
- **THEN** raw contact ids are not required to render as visible primary transcript text

#### Scenario: Shared row exposes local message actions
- **WHEN** the operator hovers or context-clicks a transcript row
- **THEN** the row reveals the shared local message action affordance
- **THEN** host routes can extend those actions without replacing the shared row renderer

### Requirement: Web chat view SHALL present a conversation-first shared surface

The shared room component SHALL render one durable conversation surface with transcript, notices, and composer organized as explicit primary regions. The transcript SHALL remain the dominant viewport, while metadata or helper details SHALL collapse into secondary regions without forcing hosts to duplicate the same controls around the component. The transcript/composer shell SHALL compose shared Svelte structural primitives from `@agenter/svelte-components` instead of maintaining a private layout law inside the package. The visible embedded chat geometry SHALL stay stable in host products that do not expose global Tailwind utility CSS for package internals.

#### Scenario: Transcript remains primary on compact viewports
- **WHEN** the chat component is rendered in a narrow container
- **THEN** the transcript and composer remain immediately usable without a permanently expanded side rail
- **THEN** secondary facts or helper content collapse into secondary affordances instead of shrinking the message viewport first

#### Scenario: Embedded transcript does not create visual dead zones
- **GIVEN** a host embeds the chat component inside fixed product chrome
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

### Requirement: Web chat view SHALL expose a Framework7 product island for host embedding

The shared chat package SHALL distinguish the transcript/composer leaf from the whole Web Chat product surface. The whole product surface SHALL own the Framework7 `App`, `View`, and `Page messagesContent` topology, plus the app-level styles needed by Framework7 chat primitives. Host products MAY surround that island with host-specific controls, but they SHALL NOT treat the leaf `WebChatViewHost` as a complete replacement for the Framework7 page shell.

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

### Requirement: Web chat view SHALL name the full product mode as app-view

The runnable full surface SHALL be referred to as `app-view` in product language. The filesystem path may remain historical, but docs, visible titles, and change artifacts SHALL treat the full `example` entrypoint as the canonical `app-view` mode so the integration contract stays clear. App-view SHALL support both standalone full-product mode and partial embedded room mode through URL-selected launch facts. Partial embedded mode SHALL be understood as an app-view mode, not as a lower-level widget API.

#### Scenario: App-view naming stays product-facing
- **WHEN** the full review shell is opened directly
- **THEN** the visible title and docs describe the surface as `app-view`
- **AND** the historical directory name does not change the product semantics

#### Scenario: App-view partial room mode behaves like a webview
- **WHEN** a host opens app-view with `mode=room`, room transport URL, viewer token, and viewer contact id
- **THEN** app-view renders a focused room chat route using its own Framework7 shell and app styles
- **AND** app-view connects to the backend/room transport itself instead of relying on host DOM callbacks
- **AND** the embedding host does not add resize or event bridges for normal transcript operation
- **AND** the backend remains the only synchronization source shared between host chrome and app-view
