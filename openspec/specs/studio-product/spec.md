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
