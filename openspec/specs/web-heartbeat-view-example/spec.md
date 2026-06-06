# web-heartbeat-view-example Specification

## Purpose

Define the standalone Framework7 example that proves `@agenter/web-heartbeat-view` can connect to an Agenter target, list Avatars, and open an Avatar HeartbeatPage without Studio.

## Requirements

### Requirement: Web heartbeat view example SHALL be a standalone Framework7 app

The package SHALL include a runnable standalone example app that uses Framework7 Svelte app, view, page, navbar, list, toolbar/statusbar, and route semantics as its visible shell law. The example SHALL own app bootstrap, route configuration, navigation, connection-target UI, and example-only state. It SHALL NOT require Studio shell context, Studio routes, or Storybook to demonstrate the Heartbeat package. Search is not required in the first phase.

#### Scenario: Example opens as a real app route

- **WHEN** the example dev server is started
- **THEN** the operator can open a URL in a browser and see a Framework7 app surface
- **AND** the app has its own root route, child route navigation, and reload-safe route state

#### Scenario: Storybook is not the acceptance surface

- **WHEN** the Heartbeat package is ready for user acceptance
- **THEN** the reported acceptance target is the runnable example URL
- **AND** Storybook or isolated component tests remain supporting evidence rather than the primary acceptance surface

### Requirement: Example SHALL connect independently to an Agenter target

The example SHALL provide an independent cognitive-link entry path to a selected Agenter target using existing `@agenter/client-sdk` transport/store contracts. It SHALL NOT add or require new backend endpoints in the first apply phase. The example SHALL accept the connection facts required by the client SDK, preserve explicit connection/resource states, and hydrate Avatar catalog plus Heartbeat resources by resolving each Avatar to its deterministic runtime/session identity and reusing existing session-scoped Heartbeat APIs.

#### Scenario: Operator configures a target without Studio

- **WHEN** the operator opens the example outside Studio
- **THEN** the example can establish or display an Agenter target connection from its own connection UI or configuration
- **AND** it does not depend on Studio Svelte context, Studio stores, or Studio route preloading

#### Scenario: Avatar target uses existing session-scoped APIs

- **GIVEN** the Avatar catalog returns an Avatar entry with a deterministic `runtimeId`
- **WHEN** the example opens that Avatar's HeartbeatPage
- **THEN** it uses that `runtimeId` as the canonical session identity for existing grouped Heartbeat hydration
- **AND** if session metadata must be materialized, it uses existing session creation with `autoStart:false`
- **AND** it does not require a new backend Avatar Heartbeat endpoint

#### Scenario: Connection failure remains explicit

- **WHEN** the Agenter target cannot be reached or requires unavailable auth
- **THEN** the example renders an explicit connection/resource error state
- **AND** Avatar directory and Heartbeat pages do not silently present stale or empty data as if the connection had succeeded

### Requirement: Example SHALL list Avatars as Heartbeat targets

The example SHALL provide a complete independent `Avatars` directory as the first navigation surface. The directory SHALL list the current global Avatar catalog. Every listed Avatar SHALL be a valid HeartbeatPage target because Heartbeat objectively displays database content for that Avatar. Running state SHALL only affect live-push/active status; it SHALL NOT decide whether the Avatar can be opened or whether persisted Heartbeat history may exist.

#### Scenario: Directory lists global Avatars

- **WHEN** the example hydrates the Avatar catalog
- **THEN** the root directory shows available Avatars with identity and status information
- **AND** each Avatar row can navigate to its HeartbeatPage

#### Scenario: Non-running Avatar remains an honest Heartbeat target

- **WHEN** an Avatar has no running session
- **THEN** the Avatar can still be opened as a HeartbeatPage target
- **AND** the page displays persisted Heartbeat DB content or a loaded-empty DB state
- **AND** the page shows that no live push is currently active without treating the Avatar as unavailable

### Requirement: Example SHALL route into a HeartbeatPage for one Avatar

The example SHALL provide a child `HeartbeatPage` route that opens from a selected Avatar. The route SHALL resolve that Avatar to the deterministic runtime/session id already provided by the Avatar catalog and SHALL hydrate grouped Heartbeat DB projection, model-call context when available, scheduler state when available, attention/delivery summaries when available, live-push status, and optional configable action bindings through the example connection adapter. Direct reload of a valid Heartbeat route SHALL recover enough connection and route state to render or show an explicit connection requirement.

#### Scenario: Tapping an Avatar opens HeartbeatPage

- **GIVEN** the Avatar directory shows an Avatar
- **WHEN** the operator taps that Avatar
- **THEN** the app navigates to a HeartbeatPage for that Avatar
- **AND** the page renders the Avatar identity and LoopBus runtime work through the package Heartbeat view

#### Scenario: Direct Heartbeat route hydrates or asks for connection

- **WHEN** the operator opens a HeartbeatPage URL directly
- **THEN** the example either hydrates the selected Avatar Heartbeat target through stored connection facts
- **OR** it shows an explicit connection-required state that can return the operator to the connection/directory flow

### Requirement: Example SHALL expose readonly and configable modes

The example SHALL let the operator run the HeartbeatPage in `readonly` or `configable` mode. `readonly` mode SHALL keep the page observational by hiding compact/config write controls, but SHALL NOT be treated as a backend authorization boundary. The example MAY still use existing session materialization with `autoStart:false` to read Heartbeat database facts. `configable` mode SHALL pass authorized compact/config handlers to the package so the bottom statusbar exposes compact/config actions. Mode selection SHALL be route, app setting, or launch configuration state rather than a hidden compile-time constant.

#### Scenario: Readonly example route is observational

- **WHEN** the example opens a HeartbeatPage in `readonly` mode
- **THEN** the operator can inspect grouped Heartbeat, scheduler, model-call, and attention facts
- **AND** compact/config write actions are not executable from the page
- **AND** backend isolation remains an authentication/authorization concern rather than a frontend mode guarantee

#### Scenario: Configable example route provides statusbar actions

- **WHEN** the example opens a HeartbeatPage in `configable` mode and the connection has authority
- **THEN** the bottom statusbar exposes compact/config actions
- **AND** those actions call the adapter's formal runtime control/config paths

### Requirement: Example SHALL verify mobile first and desktop second

The example SHALL treat iPhone-class mobile behavior as the first acceptance target and desktop as an adaptation of that behavior. Route-level verification SHALL cover the real example URL on an iPhone 14-class viewport and a desktop viewport. The final user acceptance step SHALL start the example dev server and report a live URL.

#### Scenario: Mobile navigation proves the canonical path

- **WHEN** verification runs against the example
- **THEN** it first proves the mobile path from connection/directory to Avatar selection to HeartbeatPage
- **AND** the Heartbeat stream, load-older affordance, and bottom statusbar remain usable inside the mobile safe area

#### Scenario: Desktop extends the same flow

- **WHEN** verification runs on a desktop viewport
- **THEN** the same Avatar directory and HeartbeatPage capabilities are reachable
- **AND** desktop layout changes do not remove mobile-canonical actions or require a desktop-only shortcut

#### Scenario: User acceptance receives a live URL

- **WHEN** implementation reaches user acceptance
- **THEN** the example is started on an available local port
- **AND** the response to the user includes the concrete URL for discussion and manual review
