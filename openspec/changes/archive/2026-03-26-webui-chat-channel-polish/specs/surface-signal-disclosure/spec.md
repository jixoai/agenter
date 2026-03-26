## ADDED Requirements

### Requirement: Passive metadata disclosures SHALL use a shared signal-button pattern
The WebUI SHALL provide a reusable signal disclosure primitive that renders passive status or metadata as a compact icon signal with an accessible label, tooltip fallback, and dialog-style secondary surface.

#### Scenario: Passive metadata opens from a signal trigger
- **WHEN** a route needs to expose secondary metadata without spending a full layout row
- **THEN** it renders the shared signal disclosure trigger instead of bespoke inline text stacks
- **THEN** activating the trigger opens a secondary disclosure surface with the detailed metadata

#### Scenario: Icon-only signal stays accessible
- **WHEN** the signal disclosure trigger is rendered without visible text
- **THEN** it still exposes an accessible name and tooltip-backed label
- **THEN** the trigger remains visually compact without changing the underlying action semantics

### Requirement: Signal disclosures SHALL stay secondary to the primary task surface
Passive metadata disclosed through the shared signal pattern SHALL not consume a standalone row when that row would compete with the primary task surface such as tabs, transcript content, or list controls.

#### Scenario: Chat route keeps transcript space primary
- **WHEN** the chat route renders channel metadata alongside channel tabs
- **THEN** the metadata is available from a tab-adjacent signal disclosure
- **THEN** the route does not insert a separate metadata bar between the tabs and transcript surface
