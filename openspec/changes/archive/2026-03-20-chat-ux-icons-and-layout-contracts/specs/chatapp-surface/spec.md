## MODIFIED Requirements

### Requirement: Workspace Chat SHALL use a reusable ChatApp surface
The WebUI SHALL provide a reusable ChatApp surface for workspace Chat that composes the message-bubble transcript viewport, avatar/icon rendering, attachment tray, preview affordances, restrained time dividers, per-message context menus, and the shared AI composer as independent project-local components.

#### Scenario: Chat route renders through the shared ChatApp surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the route renders the conversation viewport, attachment affordances, and composer through the shared ChatApp component set
- **THEN** the route does not rely on one monolithic chat component for all concerns

#### Scenario: Chat transcript exposes expert actions without leaking cycle UI
- **WHEN** the user opens a message-level menu or long-press action inside the ChatApp transcript
- **THEN** the transcript can expose copy and expert inspection actions for that message
- **THEN** the default bubble transcript still avoids visible cycle rows or cycle badges
