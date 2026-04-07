## ADDED Requirements

### Requirement: Redirect-only entry pages resolve before feature rendering
The WebUI SHALL resolve redirect-only entry pages to their canonical destination before any intermediate feature page renders in the browser.

#### Scenario: Root entry resolves to the avatars system
- **WHEN** the operator opens `/`
- **THEN** the browser lands on the canonical Avatars destination without showing `500 Internal Error`

#### Scenario: Avatars system entry resolves to the workspace view
- **WHEN** the operator opens `/avatars`
- **THEN** the browser lands on the canonical avatars workspace destination without showing an intermediate error surface

### Requirement: Nested runtime entry routes resolve to their canonical tab
The WebUI SHALL resolve nested runtime entry routes to their canonical runtime tab before the runtime workbench renders.

#### Scenario: Runtime entry resolves to attention
- **WHEN** the operator opens `/avatars/runtime/{sessionId}`
- **THEN** the browser lands on `/avatars/runtime/{sessionId}/attention` without rendering `500 Internal Error`
