## MODIFIED Requirements

### Requirement: Flutter chat view docs SHALL match the canonical chat transport contract
The Flutter chat-view package SHALL expose a real renderer-neutral contract that stays compatible with the canonical room-first message system instead of remaining a docs-only placeholder. Its public controller, model, and package docs SHALL use the authorized room websocket endpoint `ws(s)://HOST/room/<chatId>?token=...`, SHALL accept server events `snapshot`, `messages`, `page`, `focus`, and `error`, SHALL send client actions `send`, `edit`, `recall`, `page`, and `focus`, and SHALL keep room asset upload as the separate HTTP flow `POST /api/rooms/{chatId}/assets` with `x-agenter-room-access-token`. The package SHALL keep rendering separate from transport and upload law so Flutter Web, Android, iOS, and macOS shells can reuse the same core without `packages/webui` coupling.

#### Scenario: Flutter implementation starts from the package instead of reverse-engineering WebUI
- **WHEN** a future engineer starts the next Flutter milestone
- **THEN** `packages/flutter-chat-view` already exposes the canonical room transport and upload contract
- **THEN** they do not need to infer websocket paths or upload headers from `packages/webui`

#### Scenario: Controller derives room identity and upload base from the configured transport URL
- **WHEN** the host provides a room websocket transport URL and an optional overriding access token
- **THEN** the controller resolves the final websocket URL with the correct `token` query
- **THEN** it derives the HTTP base URL and room id from that same transport URL for room asset upload

## ADDED Requirements

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
