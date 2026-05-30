## ADDED Requirements

### Requirement: App runtime vocabulary SHALL replace extension vocabulary on active platform surfaces

Agenter SHALL present first-party and community attachable software units as apps rather than extensions on active platform surfaces. Active source roots, launcher descriptors, specs, tests, release scripts, and scaffolded templates SHALL use app vocabulary unless they are explicitly documenting historical compatibility. Core runtime modules SHALL remain app-agnostic after descriptor lookup.

#### Scenario: Active source layout uses apps root

- **WHEN** reviewers inspect active first-party app source roots
- **THEN** Shell and Studio live under `apps/*`
- **AND** `apps/*` is absent from active workspace discovery
- **AND** any remaining `extensions` references are archived history or explicitly marked legacy compatibility

#### Scenario: Active specs use app vocabulary

- **WHEN** reviewers inspect active long-lived specs after this change is synced
- **THEN** app-platform surfaces use app vocabulary
- **AND** extension vocabulary is not used to describe active Shell, Studio, or community app creation

#### Scenario: Core still does not import app implementations

- **WHEN** the active vocabulary changes from extension to app
- **THEN** core packages still do not import Shell, Studio, or community app implementation packages
- **AND** app packages still consume platform capabilities through descriptor, daemon/client-sdk, resource binding, and attention contracts

### Requirement: App package metadata SHALL separate discovery, compatibility, and launch facts

An Agenter app package SHALL keep discovery, compatibility, and launch metadata separate. Discovery metadata MAY identify the package as an Agenter app candidate. Compatibility SHALL be declared through `peerDependencies.agenter`. Launch facts SHALL live in the app descriptor or manifest and SHALL include app id, command, bin, optional main export, and capability hints.

#### Scenario: Compatibility is not inferred from package keywords

- **GIVEN** a package has an Agenter app keyword or catalog entry
- **WHEN** Agenter evaluates compatibility with the current host
- **THEN** it reads the package's `peerDependencies.agenter`
- **AND** it does not treat the keyword or catalog entry as compatibility proof

#### Scenario: Launch descriptor is not inferred from peer dependencies

- **GIVEN** a package declares `peerDependencies.agenter`
- **WHEN** Agenter launches the app
- **THEN** it still requires descriptor or manifest data for command, bin, and capability hints
- **AND** it does not infer a command name from the npm package name alone

#### Scenario: Manifest fields stay data-only

- **WHEN** core reads app manifest or descriptor data
- **THEN** it treats the fields as data
- **AND** it does not execute app implementation code during descriptor parsing

## MODIFIED Requirements

### Requirement: Core SHALL expose app capabilities without importing app modules

Agenter core SHALL provide programmable app contracts for ordinary-user and community apps. App packages such as Shell and Studio SHALL consume those contracts from outside core modules. Core packages SHALL NOT import app implementation packages or branch on app-specific UI, grammar, layout, hosting, serving, or local state.

#### Scenario: App descriptor is data, not a core branch

- **WHEN** the core launcher handles an app command such as `shell`
- **THEN** it resolves a controlled app descriptor containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import Shell implementation code
- **AND** app-specific grammar such as optional Avatar, default assistant, session naming, or app-local flags is parsed by the app package, not by core runtime modules

#### Scenario: Studio descriptor is data, not a core branch

- **WHEN** the core launcher handles app command `studio`
- **THEN** it resolves descriptor data containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import Studio implementation code
- **AND** Studio-specific serving flags are parsed by the Studio app package, not core runtime modules

#### Scenario: Core remains valid when Shell app is absent

- **WHEN** the Shell app package is absent or disabled
- **THEN** core terminal, room, AvatarRuntime, attention, and daemon modules remain valid
- **AND** no core module requires Shell UI state, toolbar state, terminal-grid layout, or session-name normalization to start

#### Scenario: Core remains valid when Studio app is absent

- **WHEN** the Studio app package is absent or disabled
- **THEN** core daemon, terminal, room, AvatarRuntime, attention, auth-service, and client-sdk modules remain valid
- **AND** no core module requires Studio route state, SvelteKit build output, browser storage keys, or Storybook state to start

#### Scenario: App consumes runtime through daemon or client SDK

- **WHEN** Shell runs as a local workspace app during tests or as a published package for users
- **THEN** it consumes app-platform capabilities through daemon/client-sdk style contracts
- **AND** it does not import core runtime internals merely because the package is colocated in the monorepo
- **AND** the same contract boundary remains visible when Shell is removed or published independently

#### Scenario: Future apps reuse the same app law

- **WHEN** another first-party or community app is added later
- **THEN** it can declare an app descriptor and consume the same launch, resource binding, assistant initialization, and attention APIs
- **AND** core does not need a new app-specific runtime branch equivalent to `if app is shell`

### Requirement: App packages SHALL bind backend resources through generic app-owned keys

The app runtime SHALL expose generic APIs that let an app ensure or look up backend resources through the resource owner's control plane. App packages SHALL provide `appId` and app-local `resourceKey` values, while the owning systems remain the only authorities for terminal, room, AvatarRuntime, attention, and runtime actor truth. For runtime-owned terminal and room bindings, grant actor ids and focus truth SHALL derive from the created or reused session runtime actor identity rather than from global avatar catalog metadata.

#### Scenario: App ensures a terminal through app namespace

- **WHEN** Shell wants the internal terminal for session `1`
- **THEN** it computes an app-owned resource key
- **AND** it calls a generic app resource binding API with `appId=shell`, the app-owned resource key, and resource kind `terminal`
- **AND** the terminal is still created, configured, granted, focused, read, and written through `terminal-system`
- **AND** core resource binding does not hard-code Shell naming rules

#### Scenario: App ensures a room through app namespace

- **WHEN** Shell wants the app room for a Shell session
- **THEN** it calls a generic app resource binding API with `appId=shell`, the app-owned resource key, and resource kind `room`
- **AND** the durable room id is allocated by `message-system`
- **AND** app metadata links the room to the app resource key without making the key the room id

#### Scenario: App binds default Avatar focus without multiplying runtime identity

- **WHEN** Shell binds a terminal and room without an explicit Avatar mention
- **THEN** it attaches those resources to the existing AvatarRuntime identity for the Shell default Avatar
- **AND** it does not create an app-session-specific runtime identity
- **AND** focus and grants stay in the owning systems' native authority models

#### Scenario: App preserves explicit Avatar override

- **WHEN** Shell binds a terminal and room for explicit Avatar `default`
- **THEN** it attaches those resources to the existing AvatarRuntime identity for Avatar `default`
- **AND** the app runtime does not replace the explicit Avatar with the app default

#### Scenario: Session actor truth governs runtime-owned terminal binding

- **GIVEN** Shell selects an avatar through the global avatar catalog
- **AND** the created or reused session runtime actor identity differs from the catalog principal metadata
- **WHEN** Shell ensures the runtime-owned terminal binding for an app resource key
- **THEN** terminal grant and runtime focus derive from the session runtime actor identity
- **AND** the app runtime does not substitute the catalog principal as terminal binding truth

#### Scenario: Session actor truth governs runtime-owned room binding

- **GIVEN** Shell selects an avatar through the global avatar catalog
- **AND** the created or reused session runtime actor identity differs from the catalog principal metadata
- **WHEN** Shell ensures the runtime-owned room binding for an app resource key
- **THEN** room grant and runtime focus derive from the session runtime actor identity
- **AND** the app runtime does not substitute the catalog principal as room binding truth

#### Scenario: Runtime-owned focus uses session-scoped focus planes

- **WHEN** a runtime-owned terminal or room binding requests focus
- **THEN** the app runtime applies terminal focus through the session-owned terminal focus API
- **AND** it applies room focus through the session-owned message-channel focus API
- **AND** unrelated global-only focus state does not count as sufficient runtime focus truth

#### Scenario: Binding outputs preserve session actor truth for later attribution

- **WHEN** an app bootstrap needs actor identity later for terminal activity attribution, unread projection, managed-mode state, or reconnect behavior
- **THEN** the binding/bootstrap flow preserves the session runtime actor truth in its outputs
- **AND** later app behavior does not re-derive actor identity from catalog metadata alone

## REMOVED Requirements

### Requirement: Active platform surfaces describe apps as extensions

**Reason**: The user explicitly stated that Agenter is now a dev-platform and the `extension` keyword should be upgraded to `app`.
**Migration**: Replace active extension vocabulary with app vocabulary. Historical archived changes may keep original wording.

## RENAMED Requirements

FROM: `Core SHALL expose app-extension capabilities without importing app modules`
TO: `Core SHALL expose app capabilities without importing app modules`

FROM: `App extensions SHALL bind backend resources through generic app-owned keys`
TO: `App packages SHALL bind backend resources through generic app-owned keys`
