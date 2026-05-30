# app-runtime Specification

## Purpose
Define the generic contracts ordinary-user and community apps use to bind backend resources, initialize assistants, and project attention without polluting core runtime modules.

## Requirements

### Requirement: Core SHALL expose app capabilities without importing app modules

Agenter core SHALL provide programmable app contracts for ordinary-user and community apps. App packages such as `agenter-app-shell` and `agenter-app-studio` SHALL consume those contracts from outside core modules. Core packages SHALL NOT import app implementation packages or branch on app-specific UI, grammar, layout, hosting, serving, or local state.

#### Scenario: App descriptor is data, not a core branch
- **WHEN** the core launcher handles a app command such as `shell`
- **THEN** it resolves a controlled app descriptor containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import `agenter-app-shell` implementation code
- **AND** app-specific grammar such as optional `@avatar`, default `shell-assistant`, `--session`, or `shell-1` is parsed by the app package, not by core runtime modules

#### Scenario: Studio descriptor is data, not a core branch
- **WHEN** the core launcher handles app command `studio`
- **THEN** it resolves descriptor data containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import `agenter-app-studio` implementation code
- **AND** Studio-specific serving flags are parsed by the Studio package, not core runtime modules

#### Scenario: Core remains app-agnostic after Shell is removed
- **WHEN** the `agenter-app-shell` package is absent or disabled
- **THEN** core terminal, room, AvatarRuntime, attention, and daemon modules remain valid
- **AND** no core module requires Shell UI state, toolbar state, terminal-grid layout, or session-name normalization to start

#### Scenario: Core remains valid when Studio is absent
- **WHEN** the `agenter-app-studio` package is absent or disabled
- **THEN** core daemon, terminal, room, AvatarRuntime, attention, auth-service, and client-sdk modules remain valid
- **AND** no core module requires Studio route state, SvelteKit build output, browser storage keys, or Storybook state to start

#### Scenario: App consumes runtime through daemon or client SDK
- **WHEN** Shell runs as a local workspace app during tests or as a published package for users
- **THEN** it consumes app capabilities through daemon/client-sdk style contracts
- **AND** it does not import core runtime internals merely because the package is colocated in the monorepo
- **AND** the same contract boundary remains visible when Shell is removed or published independently

#### Scenario: Future apps reuse the same app law
- **WHEN** another first-party or community app is added later
- **THEN** it can declare an app descriptor and consume the same launch, resource binding, assistant initialization, and attention APIs
- **AND** core does not need a new app-specific runtime branch equivalent to `if app is shell`

### Requirement: App packages SHALL initialize assistant resources through generic APIs

The app runtime SHALL let apps ensure Avatar, prompt-source, and avatar-private memory resources through generic Avatar and WorkspaceSystem APIs. App packages SHALL provide app defaults, but core runtime modules SHALL remain app-agnostic and prompt/memory files SHALL remain openly editable user assets.

#### Scenario: App ensures default assistant without core special case
- **WHEN** Shell needs default Avatar `shell-assistant`
- **THEN** it requests Avatar ensure through a generic Avatar/app API
- **AND** it may create missing app-owned prompt and memory defaults through generic prompt/workspace resource APIs
- **AND** core launcher modules do not hard-code the `shell-assistant` nickname

#### Scenario: App prompt initialization stays open and seed-if-missing
- **GIVEN** app-owned default prompt or memory resources already exist for an Avatar
- **WHEN** Shell runs its initialization flow
- **THEN** it reads the existing files as current truth
- **AND** it creates missing resources without locking or automatically restoring app defaults over user edits
- **AND** advanced users may edit those resources manually

### Requirement: App packages SHALL bind backend resources through generic app-owned keys

The app runtime SHALL expose generic APIs that let an app ensure or look up backend resources through the resource owner's control plane. App packages SHALL provide `appId` and app-local `resourceKey` values, while the owning systems remain the only authorities for terminal, room, AvatarRuntime, attention, and runtime actor truth. For runtime-owned terminal and room bindings, grant actor ids and focus truth SHALL derive from the created or reused session runtime actor identity rather than from global avatar catalog metadata.

#### Scenario: App ensures a terminal through app namespace
- **WHEN** Shell wants the internal terminal for `--session=1`
- **THEN** it computes app-owned key `shell-1`
- **AND** it calls a generic app resource binding API with `appId=shell`, `resourceKey=shell-1`, and resource kind `terminal`
- **AND** the terminal is still created, configured, granted, focused, read, and written through `terminal-system`
- **AND** core resource binding does not hard-code the `shell-1` naming rule

#### Scenario: App ensures a room through app namespace
- **WHEN** Shell wants the app room for `shell-1`
- **THEN** it calls a generic app resource binding API with `appId=shell`, `resourceKey=shell-1`, and resource kind `room`
- **AND** the durable room id is allocated by `message-system`
- **AND** app metadata links the room to the app resource key without making the key the room id

#### Scenario: App binds default Avatar focus without multiplying runtime identity
- **WHEN** Shell binds a terminal and room without an explicit `@avatar` mention
- **THEN** it attaches those resources to the existing AvatarRuntime identity for Avatar `shell-assistant`
- **AND** it does not create a app-session-specific runtime identity
- **AND** focus and grants stay in the owning systems' native authority models

#### Scenario: App preserves explicit Avatar override
- **WHEN** Shell binds a terminal and room for explicit Avatar `default`
- **THEN** it attaches those resources to the existing AvatarRuntime identity for Avatar `default`
- **AND** the app runtime does not replace the explicit Avatar with the app default

#### Scenario: Session actor truth governs runtime-owned terminal binding
- **GIVEN** Shell selects an avatar through the global avatar catalog
- **AND** the created or reused session runtime actor identity differs from the catalog principal metadata
- **WHEN** Shell ensures the runtime-owned terminal binding for app resource key `shell-1`
- **THEN** terminal grant and runtime focus derive from the session runtime actor identity
- **AND** the app runtime does not substitute the catalog principal as terminal binding truth

#### Scenario: Session actor truth governs runtime-owned room binding
- **GIVEN** Shell selects an avatar through the global avatar catalog
- **AND** the created or reused session runtime actor identity differs from the catalog principal metadata
- **WHEN** Shell ensures the runtime-owned room binding for app resource key `shell-1`
- **THEN** room grant and runtime focus derive from the session runtime actor identity
- **AND** the app runtime does not substitute the catalog principal as room binding truth

#### Scenario: Runtime-owned focus uses session-scoped focus planes
- **WHEN** a runtime-owned terminal or room binding requests focus
- **THEN** the app runtime applies terminal focus through the session-owned terminal focus API
- **AND** it applies room focus through the session-owned message-channel focus API
- **AND** unrelated global-only focus state does not count as sufficient runtime focus truth

#### Scenario: Binding outputs preserve session actor truth for later attribution
- **WHEN** a app bootstrap needs actor identity later for terminal activity attribution, unread projection, managed-mode state, or reconnect behavior
- **THEN** the binding/bootstrap flow preserves the session runtime actor truth in its outputs
- **AND** later app behavior does not re-derive actor identity from catalog metadata alone

### Requirement: App packages SHALL use attention as their scheduling and projection surface

The app runtime SHALL let apps publish app-scoped attention facts and consume Heartbeat projections without hidden app prompt glue. The model-visible content SHALL be attention body or typed tool/query output; app metadata SHALL remain scheduler/provenance information.

#### Scenario: App status is an attention projection
- **WHEN** Shell renders the toolbar Heartbeat text
- **THEN** it reads the latest visible Heartbeat message-part projection
- **AND** it may compact terminal/message/attention tool activity for display
- **AND** it does not create a second toolbar-owned event log as truth

#### Scenario: App ingress creates attention, not kernel branches
- **WHEN** Shell observes app-relevant facts such as unread room messages, terminal idle-ready state, or hosting attention changes
- **THEN** it expresses required AI follow-up through app-scoped attention contexts or items
- **AND** LoopBus scheduling consumes those attention facts through the normal attention law
- **AND** the kernel does not gain Shell-specific scheduling rules

#### Scenario: Managed mode creates hosting attention
- **WHEN** Shell managed mode is enabled
- **THEN** the app commits a app-scoped AttentionItem with the literal fixed score key `scores: {"hosting": 1000}`
- **AND** the item body carries the active hosting objective and app resource context
- **AND** the score remains positive until the Avatar or user settles it through normal attention commit law

#### Scenario: App metadata stays projection-safe
- **WHEN** a app-scoped attention item references app state
- **THEN** app id, resource key, terminal id, room id, and hosting memory role ids may appear as provenance metadata
- **AND** AI-visible instructions or obligations appear in the attention body
- **AND** metadata does not become a hidden side channel for app behavior

### Requirement: App packages SHALL expose minimal programmable attention-cli compatible operations for self-evolution

The app runtime SHALL expose enough generic attention operations for apps, skills, and assistants to compose self-evolution loops without adding named kernel features. In this change, the required minimum is commit, query, and settle. Richer watch or schedule primitives are deferred to a separate change.

#### Scenario: Assistant composes a self-evolution loop through attention-cli
- **WHEN** a user teaches `shell-assistant` a reflection workflow such as a nightly `auto-dream`-style review
- **THEN** the assistant or app can commit, query, and settle self-evolution attention contexts through attention-cli compatible APIs
- **AND** the loop can guide memory or skill updates through normal assistant reasoning
- **AND** it does not depend on a dedicated watch or schedule primitive in this change
- **AND** the kernel does not reserve `auto-dream` as a fixed app feature, score key, or scheduler branch

#### Scenario: Self-evolution attention remains separate from hosting attention
- **WHEN** a self-evolution loop is active while Shell managed mode is off
- **THEN** the loop may use app-scoped attention to schedule reflection or memory work
- **AND** it does not require `scores: {"hosting": 1000}`
- **AND** it does not grant terminal write authority
- **AND** any terminal write still requires TerminalSystem-native writer authority, guard approval, or an active terminal write lease

#### Scenario: Future apps reuse programmable attention operations
- **WHEN** another app needs a recurring learning, reflection, or maintenance loop
- **THEN** it can reuse the same attention-cli compatible commit/query/settle operations from this change
- **AND** core does not gain a app-specific branch for that app's named ritual
- **AND** if recurring watch/schedule behavior is needed, it belongs to the follow-up `extend-attention-cli-self-evolution-runtime` change

### Requirement: App hosting SHALL remain separate from terminal authority

App packages SHALL model hosting and managed continuity as app-scoped attention facts. Positive hosting attention may schedule or wake the Avatar, but it SHALL NOT grant terminal write authority, mint terminal write leases, create permanent writer grants, or introduce app-owned write delegation as a second authorization truth. Terminal mutation SHALL return to TerminalSystem-native grants, guard approval requests, and timeboxed write leases.

#### Scenario: Managed toggle creates hosting attention only
- **WHEN** the user enables Shell managed/takeover mode
- **THEN** Shell commits positive hosting attention for the current app terminal and room
- **AND** no app write delegation, terminal write lease, or permanent writer grant is created only because hosting was enabled
- **AND** the attention content records the granting user principal, summoned Avatar principal, app id, shell name, terminal id, room id, enabled time, and current objective

#### Scenario: Managed toggle off settles hosting attention only
- **WHEN** the user disables Shell managed/takeover mode
- **THEN** Shell commits a hosting attention update with `scores: {"hosting": 0}` and reason `user_disabled`
- **AND** terminal grants, guard approval requests, and write leases remain governed only by TerminalSystem authority
- **AND** unrelated terminal grants, room grants, and user manual terminal input remain valid

#### Scenario: Autonomous terminal effects are attributed to the Avatar and terminal authority
- **WHEN** the Avatar writes terminal input while Shell managed/takeover is active
- **THEN** the terminal write is submitted with the Avatar actor identity
- **AND** the terminal activity record carries enough provenance to resolve the TerminalSystem grant, guard approval request, or lease that authorized the write
- **AND** superadmin bootstrap authority is not used as the hidden actor for autonomous terminal effects

#### Scenario: Managed off keeps attention but blocks autonomous writes
- **WHEN** Shell managed/takeover mode is off
- **THEN** the Avatar may observe terminal and room context, answer in the room, and request approval
- **AND** it must not autonomously write to the terminal without TerminalSystem-native writer authority, guard approval, or an active terminal write lease
- **AND** terminal idle/dirty observations do not self-drive takeover work solely because the toolbar exists

#### Scenario: Hosting attention can remain open for watch tasks
- **WHEN** the active hosting objective is an open-ended watch task
- **THEN** the Avatar may keep the `hosting` score positive
- **AND** it records progress and watch policy as durable memory or attention facts
- **AND** the runtime does not force `hosting` to zero merely because one model round ended

#### Scenario: Hosting policy prevents no-progress loops
- **WHEN** hosting attention is active and repeated model rounds produce no terminal progress or equivalent failures
- **THEN** the app runtime records backoff, blocked, expired, or settled state as explicit attention facts
- **AND** LoopBus does not spin indefinitely only because hosting remains enabled
