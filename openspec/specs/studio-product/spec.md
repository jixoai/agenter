# studio-app Specification

## Purpose

Define the active `agenter-app-studio` operator app package, its launcher contract, and its boundary from core runtime modules.

## Requirements

### Requirement: Studio SHALL be the active operator app package

The active SvelteKit operator app SHALL be published and resolved as `agenter-app-studio` from `apps/studio`. The package SHALL own Studio-specific CLI grammar, static serving, dev serving, route assets, Storybook workflow, and browser-facing lifecycle.

#### Scenario: Workspace package resolves as Studio

- **WHEN** workspace package discovery resolves the active operator app
- **THEN** it resolves package `agenter-app-studio`
- **AND** it resolves from `apps/studio`
- **AND** it does not resolve the active app from `@agenter/webui` or `packages/webui`

#### Scenario: Studio owns app CLI grammar

- **WHEN** a user runs `agenter studio --dev --web-port 4173`
- **THEN** core CLI forwards `--dev --web-port 4173` as app argv
- **AND** `agenter-app-studio` parses those flags
- **AND** core CLI does not parse Studio-specific static or dev-server flags

### Requirement: Studio SHALL consume launcher-owned daemon context

`agenter-app-studio` SHALL consume daemon and auth-service context through the app launcher environment contract. Studio SHALL NOT discover or persist a second daemon authority, and SHALL NOT import core runtime internals because it is colocated in the monorepo.

#### Scenario: Studio receives daemon env from the launcher

- **WHEN** the app launcher starts `agenter-app-studio`
- **THEN** the app receives `AGENTER_DAEMON_HOST` and `AGENTER_DAEMON_PORT`
- **AND** browser runtime configuration points to that daemon's `/trpc` endpoint
- **AND** Studio does not independently start a competing daemon

#### Scenario: Studio stays outside core runtime internals

- **WHEN** reviewers inspect Studio startup code
- **THEN** Studio consumes runtime through daemon/client-sdk contracts
- **AND** it does not import `@agenter/app-server` runtime internals, session runtime modules, or core CLI static-root helpers

### Requirement: Studio SHALL expose MCP as a primary workbench destination

Studio SHALL expose an app-shell navigation item named `MCP` that opens `/mcp` as an independent system workbench destination. The MCP workbench SHALL consume client-runtime-store MCP contracts and SHALL NOT import `app-server`, `mcp-system`, or root-workspace CLI implementation internals.

#### Scenario: MCP route is reachable from app shell

- **WHEN** the operator opens Studio navigation
- **THEN** the primary systems navigation includes `MCP`
- **AND** activating it opens `/mcp`
- **AND** the active navigation state follows `/mcp` and nested MCP routes

#### Scenario: MCP route stays inside Studio app boundary

- **WHEN** reviewers inspect the MCP route and feature source
- **THEN** it imports MCP data through Studio app controller and client-runtime-store facades
- **AND** it does not import `packages/app-server/src/mcp-system/*`, runtime internals, or cli-shell modules

### Requirement: MCP workbench SHALL separate config truth from Avatar ownership projection

The MCP workbench SHALL present durable global MCP configs separately from Avatar-owned exact-project instances and ownership facts. `Configs` SHALL stay config-first across Avatars, with owner Avatar expressed as part of each config row and detail state. Viewing or creating a global config SHALL NOT imply project enablement or start any MCP server unless the operator explicitly opts into one exact-project enable/start action.

#### Scenario: MCP home exposes configs and avatars tabs

- **WHEN** the operator opens `/mcp`
- **THEN** the page toolbar exposes `Configs` and `Avatars` tabs
- **AND** `Configs` is a config-first list-detail surface
- **AND** `Avatars` is a read-only Avatar ownership overview

#### Scenario: Config owner is expressed per row and detail

- **WHEN** the operator opens `Configs`
- **THEN** the list shows each config together with its owner Avatar
- **AND** `New config` chooses one owner Avatar inside detail instead of through a page-level Avatar selector
- **AND** edit detail keeps owner Avatar visible as read-only config truth

#### Scenario: Configs uses one list-detail atom for new and edit

- **WHEN** the operator opens `Configs`
- **THEN** the left list starts with one `New config` item followed by installed global configs
- **AND** selecting `New config` renders the config form in create mode
- **AND** selecting an installed config renders the same form in edit mode plus a read-only exact-project instance list
- **AND** the page does not split config creation into a separate top-level route or tab

#### Scenario: New can explicitly start one exact project MCP

- **WHEN** the operator creates a global MCP config from `Configs`
- **AND** opts into exact-project enablement and start
- **THEN** Studio calls the typed runtime-store MCP facade in add, enable, then start order
- **AND** the start step remains explicit before submission
- **AND** other projects remain disabled by default

#### Scenario: Avatars tab stays read-only ownership projection

- **WHEN** the operator opens `Avatars`
- **THEN** each Avatar row summarizes owned configs, exact-project rows, and running or failed instances
- **AND** the detail pane expands those ownership facts without introducing config mutation controls
- **AND** the list and detail use the standard avatar affordance for owner identity
- **AND** no Studio-local MCP database is created

### Requirement: MCP workbench SHALL preserve a low-noise operator surface

The MCP workbench SHALL be designed for expert operators who repeatedly use Studio. Primary page space SHALL show actionable MCP state, controls, and inspection facts rather than persistent introductory prose. Explanatory context, caveats, and low-frequency recovery guidance SHALL be collapsed into contextual help such as `HelpHint`, title or aria help, dialogs, or focused empty/error states.

#### Scenario: Primary surface avoids tutorial copy

- **WHEN** the operator opens `/mcp` with runtime data available
- **THEN** the toolbar, list, and detail surfaces prioritize runtime, project, server, lifecycle, snapshot, and action facts
- **AND** the page does not render persistent introductory paragraphs explaining what MCP is or how every control works
- **AND** low-frequency conceptual help is available through contextual help affordances instead

#### Scenario: Detail surface avoids nested card stacks

- **WHEN** the MCP detail surface renders global config, project enablement, snapshots, latest errors, and action facts
- **THEN** those sections use shared workbench, split-detail, compact section, spacing, and lightweight divider primitives
- **AND** they do not wrap each subsection in separate nested cards unless the subsection owns an independent interaction state
- **AND** border usage remains tied to actual ownership boundaries or clickable affordances

### Requirement: Studio SHALL own static and dev serving

`agenter-app-studio` SHALL serve its own built static assets in normal mode and SHALL start its own Vite dev server in dev mode. Static and dev serving are app lifecycle responsibilities, not core launcher responsibilities.

#### Scenario: Static Studio serves its package build

- **WHEN** a user runs `agenter studio`
- **THEN** the launcher resolves and starts `agenter-app-studio`
- **AND** Studio serves the package-owned SvelteKit build
- **AND** it prints the resolved browser URL

#### Scenario: Dev Studio starts a app-owned Vite server

- **WHEN** a user runs `agenter studio --dev --web-port 4173`
- **THEN** Studio starts a Vite dev server from `apps/studio`
- **AND** it injects the launcher-provided daemon `/trpc` endpoint through Studio-owned runtime env
- **AND** core CLI does not start the Vite server for Studio

### Requirement: Studio SHALL use Studio-owned durable namespaces

Active operator-app keys, browser storage namespaces, persisted UI preference keys, docs, and user-facing diagnostics SHALL use `studio` naming. `webui` namespaces MAY remain only for archived historical packages or archived change artifacts.

#### Scenario: Active preference keys use Studio namespace

- **WHEN** Studio persists an active app UI preference
- **THEN** the key uses `studio` or `agenter:studio` naming
- **AND** it does not write a new active key under `webui` or `agenter:webui`

#### Scenario: Breaking migration does not keep WebUI compatibility keys

- **WHEN** a user has old local WebUI preferences
- **THEN** Studio MAY ignore those old keys
- **AND** it does not add compatibility reads solely to preserve the obsolete package identity
