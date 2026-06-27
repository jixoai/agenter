# product-extension-runtime Specification

## Purpose

Define the shared product-extension runtime law for first-party graphical and terminal products so core runtime modules remain product-orthogonal.
## Requirements
### Requirement: App extensions SHALL initialize assistant resources through generic APIs

The extension runtime SHALL let products ensure Avatar, global prompt-source, and avatar-private memory resources through generic Avatar and WorkspaceSystem APIs. App packages SHALL provide app defaults, but core runtime modules SHALL remain app-agnostic and prompt/memory files SHALL remain openly editable user assets. App prompt seed APIs SHALL seed only the global Avatar canonical `AGENTER.mdx`; they SHALL NOT accept or interpret a workspace path as prompt root authority.

#### Scenario: Extension ensures default assistant without core special case
- **WHEN** cli-shell needs default Avatar `shell-assistant`
- **THEN** it requests Avatar ensure through a generic Avatar/app-extension API
- **AND** it may create missing app-owned prompt and memory defaults through generic APIs
- **AND** core launcher modules do not hard-code the `shell-assistant` nickname

#### Scenario: Extension prompt initialization stays open and seed-if-missing
- **GIVEN** app-owned default prompt or memory resources already exist for an Avatar
- **WHEN** cli-shell runs its initialization flow
- **THEN** it reads the existing files as current truth
- **AND** it creates missing resources without locking or automatically restoring app defaults over user edits
- **AND** advanced users may edit those resources manually

#### Scenario: App prompt seed ignores workspace locality
- **GIVEN** cli-shell starts from workspace `/repo`
- **AND** Avatar `shell-assistant` resolves to principal `0xabc...`
- **WHEN** cli-shell seeds the missing assistant prompt
- **THEN** the seed target is `~/.agenter/avatars/by-principal/0xabc.../AGENTER.mdx`
- **AND** the app-extension prompt seed contract does not expose `/repo` as a prompt root input

### Requirement: GUI products SHALL reuse the same app-extension law as terminal products

Graphical first-party products such as Studio SHALL consume the same descriptor, launcher env, app source, resource binding, assistant, and attention contracts as terminal products. Core runtime modules SHALL NOT add GUI-app-specific imports or branches for Studio.

#### Scenario: Studio descriptor is data, not a core branch

- **WHEN** the core launcher handles app command `studio`
- **THEN** it resolves descriptor data containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import `agenter-app-studio` implementation code
- **AND** Studio-specific serving flags are parsed by the Studio package, not core runtime modules

#### Scenario: Core remains valid when Studio is absent

- **WHEN** the `agenter-app-studio` package is absent or disabled
- **THEN** core daemon, terminal, room, AvatarRuntime, attention, auth-service, and client-sdk modules remain valid
- **AND** no core module requires Studio route state, SvelteKit build output, browser storage keys, or Storybook state to start

### Requirement: App extension runtime SHALL expose APIs instead of owning app lifecycle reactions

The app runtime SHALL remain a public API and projection surface for products. It MAY expose resource binding, lifecycle subscription, and owner-system operation contracts. It SHALL NOT own app-specific lifecycle reactions such as shell-next terminal killed -> archive bound room.

#### Scenario: App code programs against public lifecycle APIs

- **WHEN** a app needs to react to terminal, room, or attention lifecycle
- **THEN** the app consumes public lifecycle/API contracts
- **AND** the app implements its app-specific reaction in its own package
- **AND** the app runtime does not become a bottom-layer reaction host for that app behavior

#### Scenario: Core remains app-agnostic when shell-next reaction exists

- **WHEN** shell-next implements terminal killed -> archive bound room
- **THEN** core terminal, room, attention, and app-extension runtime modules remain valid without importing shell-next code
- **AND** no core module contains a branch equivalent to "if app is shell-next"

### Requirement: App extensions SHALL clear selected runtime sessions through generic session authority

App extensions SHALL be able to reset a app-selected Avatar's runtime session context through generic session authority. The app-extension runtime SHALL NOT add app-specific runtime identity axes or app-owned conversation databases to support this workflow.

#### Scenario: App clears current Avatar runtime session

- **GIVEN** a app has selected Avatar `review-4` for workspace `/repo`
- **AND** a runtime session already exists for that Avatar and workspace
- **AND** another workspace also has a runtime session for Avatar `review-4`
- **WHEN** the app requests a runtime-session clear before attach
- **THEN** the extension flow uses the generic session delete or equivalent session reset authority
- **AND** the next ensure-runtime call creates or reuses only the canonical AvatarRuntime identity for Avatar `review-4`
- **AND** the other workspace's runtime session is not cleared

#### Scenario: Clear preserves Avatar assets

- **WHEN** app-extension runtime clears a selected Avatar runtime session
- **THEN** it does not delete the Avatar principal
- **AND** it does not delete nickname aliases, canonical prompt files, memory files, profile media, workspace files, room catalog entries, or terminal catalog entries as a side effect

#### Scenario: Core remains unaware of cli-shell flags

- **WHEN** cli-shell uses `--avatar`, `--create-avatar`, or `--clear-avatar`
- **THEN** app-extension runtime exposes only generic Avatar ensure and session clear operations
- **AND** core runtime modules do not branch on those cli-shell flag names
