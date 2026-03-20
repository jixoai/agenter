## ADDED Requirements

### Requirement: WebUI surfaces SHALL model loading and emptiness independently
The WebUI SHALL treat content availability and loading activity as separate state dimensions so that a surface can be empty while loading, empty while idle, populated while loading, or populated while idle.

#### Scenario: Empty surface shows loading treatment while fetching
- **WHEN** a surface has no data yet and a fetch is in progress
- **THEN** the UI renders a loading treatment instead of idle empty-state copy

#### Scenario: Populated surface stays visible while refreshing
- **WHEN** a surface already has data and a refresh is in progress
- **THEN** the existing data remains visible and the UI adds a non-destructive loading affordance on top of it

### Requirement: Shared async surface primitives SHALL be reused across workspace views
The WebUI SHALL provide shared async-surface primitives for the major application views so that `Quick Start`, `Workspaces`, `Sessions`, `Settings`, and workspace tool views do not hand-roll incompatible loading shells.

#### Scenario: Shared async surface is used by application panels
- **WHEN** one of the workspace application panels needs to render empty, loading, or refreshing states
- **THEN** it uses the shared async-surface contract instead of bespoke per-panel loading markup
