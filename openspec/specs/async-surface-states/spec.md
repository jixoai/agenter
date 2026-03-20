## Purpose

Define the shared loading and emptiness contract used by major WebUI application surfaces.
## Requirements
### Requirement: WebUI surfaces SHALL model loading and emptiness independently
The WebUI SHALL treat content availability and loading activity as separate state dimensions and MUST expose them through an explicit four-state async surface contract: `empty-loading`, `empty-idle`, `ready-loading`, and `ready-idle`.

#### Scenario: Empty surface shows loading treatment while fetching
- **WHEN** a surface has no data yet and a fetch is in progress
- **THEN** the UI renders a loading treatment instead of idle empty-state copy
- **THEN** the surface state is represented as `empty-loading`

#### Scenario: Empty surface shows idle empty-state copy
- **WHEN** a surface has no data and no fetch is in progress
- **THEN** the UI renders the idle empty-state treatment
- **THEN** the surface state is represented as `empty-idle`

#### Scenario: Populated surface stays visible while refreshing
- **WHEN** a surface already has data and a refresh is in progress
- **THEN** the existing data remains visible and the UI adds a non-destructive loading affordance on top of it
- **THEN** the surface state is represented as `ready-loading`

#### Scenario: Populated surface stays idle without overlay
- **WHEN** a surface already has data and no refresh is in progress
- **THEN** the existing data remains visible without a loading overlay
- **THEN** the surface state is represented as `ready-idle`

### Requirement: Shared async surface primitives SHALL be reused across workspace views
The WebUI SHALL provide shared async-surface primitives for fetch-driven application views so that `Quick Start`, `Workspaces`, `Sessions`, `Settings`, `Model`, `Terminal`, `Tasks`, `Process`, and `LoopBus` do not hand-roll incompatible loading shells. The shared async-surface primitive MUST model state and loading overlays without implicitly owning clipping, scrolling, or semantic background ownership.

#### Scenario: Shared async surface is used by application panels
- **WHEN** one of the fetch-driven application panels needs to render empty, loading, or refreshing states
- **THEN** it uses the shared async-surface contract instead of bespoke per-panel loading markup

#### Scenario: First-load panels keep skeleton and empty states distinct
- **WHEN** a panel performs its first fetch and has no data yet
- **THEN** it renders the shared loading skeleton treatment instead of reusing the idle empty-state copy

#### Scenario: Async surface does not become a clipping wrapper
- **WHEN** a panel composes a shared async surface with long content
- **THEN** the async surface itself does not silently own `overflow-hidden`
- **THEN** the caller explicitly chooses the scrolling or clipping surface needed for that panel

#### Scenario: Async surface does not become a background owner
- **WHEN** a panel composes a shared async surface inside a semantic container
- **THEN** the async surface does not add its own competing background color
- **THEN** the caller keeps background ownership on the semantic surface that already frames that panel
