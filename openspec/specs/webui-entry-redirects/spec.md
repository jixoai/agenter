# webui-entry-redirects Specification

## Purpose

Define the durable route-entry law for redirect-only Studio pages so first-level navigation lands on canonical destinations without rendering an intermediate error surface.

## Requirements

### Requirement: Redirect-only entry pages resolve before feature rendering

Studio SHALL resolve redirect-only entry pages to their canonical destination before any intermediate feature page renders in the browser, and the static CSR entry flow SHALL NOT depend on server `__data.json` responses.

#### Scenario: Root entry resolves to the avatars system

- **WHEN** the operator opens `/` through default static `agenter studio`
- **THEN** the browser lands on the canonical Avatars destination without showing `500 Internal Error`
- **THEN** the route does not fail with HTML-as-JSON parse errors during hydration

#### Scenario: Avatars system entry resolves to the catalog view

- **WHEN** the operator opens `/avatars` through default static `agenter studio`
- **THEN** the browser lands on the canonical avatars catalog destination without showing an intermediate error surface
- **THEN** the redirect completes without requiring a server `__data.json` response

### Requirement: Nested runtime entry routes resolve to their canonical tab

Studio SHALL resolve nested runtime entry routes to their canonical runtime tab before the runtime workbench renders, and the redirect SHALL remain compatible with static CSR delivery.

#### Scenario: Runtime entry resolves to heartbeat

- **WHEN** the operator opens `/avatars/runtime/{sessionId}` through default static `agenter studio`
- **THEN** the browser lands on `/avatars/runtime/{sessionId}/heartbeat` without rendering `500 Internal Error`
- **THEN** the redirect completes without an HTML-as-JSON hydration failure
