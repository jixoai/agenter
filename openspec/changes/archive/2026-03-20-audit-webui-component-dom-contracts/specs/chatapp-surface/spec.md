## MODIFIED Requirements

### Requirement: Workspace Chat SHALL use a reusable ChatApp surface
The WebUI SHALL provide a reusable ChatApp surface for workspace Chat that composes the transcript viewport, message bubbles, attachment strips, pending attachment tray, preview affordances, and shared AI composer through independent project-local components instead of one monolithic route component.

#### Scenario: Chat route renders through isolated transcript subcomponents
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the route renders message bubbles, message actions, and attachment affordances through reusable transcript subcomponents
- **THEN** those subcomponents can evolve without rewriting the whole Chat route surface

#### Scenario: Attachment affordances remain independently operable
- **WHEN** the chat surface renders queued or persisted attachments
- **THEN** the pending attachment tray and the persisted attachment strip remain independently operable surfaces
- **THEN** they do not require the full Chat route shell to verify preview and removal behavior
