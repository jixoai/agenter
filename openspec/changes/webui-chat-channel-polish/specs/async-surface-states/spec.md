## MODIFIED Requirements

### Requirement: Shared async surface primitives SHALL be reused across workspace views
The WebUI SHALL provide shared async-surface primitives for fetch-driven application views so that `Quick Start`, `Workspaces`, `Sessions`, `Settings`, `Model`, `Terminal`, `Tasks`, `Process`, `LoopBus`, chat-channel lists, cycle history lists, and similar list-or-panel surfaces do not hand-roll incompatible loading shells. The shared async-surface primitive MUST model first-load, empty, and refreshing states without implicitly owning clipping, scrolling, or semantic background ownership.

#### Scenario: Shared async surface is used by application panels
- **WHEN** one of the fetch-driven application panels needs to render empty, loading, or refreshing states
- **THEN** it uses the shared async-surface contract instead of bespoke per-panel loading markup

#### Scenario: First-load panels keep skeleton and empty states distinct
- **WHEN** a panel performs its first fetch and has no data yet
- **THEN** it renders the shared loading skeleton treatment instead of reusing the idle empty-state copy

#### Scenario: Populated panels keep content visible while refreshing
- **WHEN** a panel already has data and a refresh is in progress
- **THEN** the existing content remains visible
- **THEN** the surface adds the shared non-destructive refresh treatment instead of replacing the content with an empty loader

#### Scenario: Async surface does not become a clipping wrapper
- **WHEN** a panel composes a shared async surface with long content
- **THEN** the async surface itself does not silently own `overflow-hidden`
- **THEN** the caller explicitly chooses the scrolling or clipping surface needed for that panel

#### Scenario: Async surface does not become a background owner
- **WHEN** a panel composes a shared async surface inside a semantic container
- **THEN** the async surface does not add its own competing background color
- **THEN** the caller keeps background ownership on the semantic surface that already frames that panel
