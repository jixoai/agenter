## ADDED Requirements

### Requirement: Flutter chat demo SHALL connect from configurable room URL and token inputs
The first-phase Flutter Web delivery SHALL be a standalone demo surface under `packages/flutter-chat-view/example` instead of a `packages/webui` embed. The demo SHALL accept a room websocket transport URL and an optional room access token, create the chat controller from those values, and connect directly to the canonical room transport.

#### Scenario: Operator connects from the configuration form
- **WHEN** the operator opens the demo without prior query parameters
- **THEN** the page shows a configuration form for `Transport URL` and `Access token`
- **THEN** submitting that form creates a chat connection from those values without requiring any WebUI route

#### Scenario: Demo auto-connects from URL query parameters
- **WHEN** the operator opens the demo with `?url=...&token=...` query parameters
- **THEN** the demo hydrates the configuration form from those query parameters
- **THEN** it attempts to connect automatically using the same values

### Requirement: Flutter chat demo SHALL expose a shareable demo link for the active connection config
The standalone demo SHALL project the current `url` and `token` form values into a shareable demo link so another operator can open the same connection target directly. The copied link SHALL preserve the active query parameters exactly as the demo will use them.

#### Scenario: Copying the demo link preserves current connection inputs
- **WHEN** the operator sets or edits the `url` and `token` inputs
- **THEN** the demo recomputes a shareable link containing those same query parameters
- **THEN** the copy-link action copies that fully qualified demo URL

### Requirement: Flutter chat demo SHALL keep first-phase delivery isolated from WebUI
The demo milestone SHALL prove room transport portability without modifying or embedding `packages/webui`. The demo shell SHALL rely only on the Flutter package contract plus canonical message-system room transport and upload surfaces.

#### Scenario: Phase 1 ships without WebUI integration
- **WHEN** the first Flutter Web milestone is delivered
- **THEN** the only operator-facing entry point is the standalone demo app
- **THEN** no `packages/webui` route or component is required to access the demo
