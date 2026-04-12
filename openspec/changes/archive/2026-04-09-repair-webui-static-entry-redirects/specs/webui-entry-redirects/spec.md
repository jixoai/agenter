## MODIFIED Requirements

### Requirement: Redirect-only entry pages resolve before feature rendering

The WebUI SHALL resolve redirect-only entry pages to their canonical destination before any intermediate feature page renders in the browser, and the static CSR entry flow SHALL NOT depend on server `__data.json` responses.

#### Scenario: Root entry resolves to the avatars system

- **WHEN** the operator opens `/` through default static `agenter web`
- **THEN** the browser lands on `/avatars` without showing `500 Internal Error`
- **THEN** the route does not fail with HTML-as-JSON parse errors during hydration

#### Scenario: Avatars system entry resolves to the workspace view

- **WHEN** the operator opens `/avatars` through default static `agenter web`
- **THEN** the browser lands on `/avatars/workspace` without showing an intermediate error surface
- **THEN** the redirect completes without requiring a server `__data.json` response

### Requirement: Nested runtime entry routes resolve to their canonical tab

The WebUI SHALL resolve nested runtime entry routes to their canonical runtime tab before the runtime workbench renders, and the redirect SHALL remain compatible with static CSR delivery.

#### Scenario: Runtime entry resolves to attention

- **WHEN** the operator opens `/avatars/runtime/{sessionId}` through default static `agenter web`
- **THEN** the browser lands on `/avatars/runtime/{sessionId}/attention` without rendering `500 Internal Error`
- **THEN** the redirect completes without an HTML-as-JSON hydration failure
