## MODIFIED Requirements

### Requirement: App packages SHALL initialize assistant resources through generic APIs

The app runtime SHALL let apps ensure Avatar and global prompt-source resources through generic app APIs. App packages SHALL provide app defaults, but core runtime modules SHALL remain app-agnostic and prompt files SHALL remain openly editable user assets. App-owned default prompt resources SHALL be addressed by the Avatar principal id under the global Avatar canonical root, not by a project workspace path or nickname alias. App-owned assistant raw recording SHALL NOT be represented by an app-runtime memory-pack API; ShellAssistant recording uses NoteSystem through the active `AVATAR_HOME` note capability. WorkspaceSystem private text assets remain available only for explicitly workspace-scoped private artifacts and overlays; they MUST NOT be the default target for ShellAssistant recording.

#### Scenario: App ensures default assistant without core special case

- **WHEN** Shell needs default Avatar `shell-assistant`
- **THEN** it requests Avatar ensure through a generic Avatar/app API
- **AND** it may create missing app-owned prompt defaults through generic principal-addressed app APIs
- **AND** core launcher modules do not hard-code the `shell-assistant` nickname

#### Scenario: App prompt initialization stays open and seed-if-missing

- **GIVEN** an app-owned default prompt resource already exists for an Avatar
- **WHEN** Shell runs its initialization flow
- **THEN** it reads the existing file as current truth
- **AND** it creates the missing prompt without locking or automatically restoring app defaults over user edits
- **AND** advanced users may edit the prompt resource manually

#### Scenario: App prompt seed composes builtin and app package guidance

- **GIVEN** Shell seeds a missing default `AGENTER.mdx`
- **WHEN** the seeded prompt is rendered by the runtime prompt store
- **THEN** it may explicitly inherit daemon-materialized builtin prompt guidance through `global:builtin/$LANG/AGENTER.mdx`
- **AND** it may include Shell-owned package guidance through `app:shell/ShellAssistant.mdx`
- **AND** `super:` remains reserved for parent prompt layers and MUST NOT implicitly point at builtin prompts
- **AND** the core runtime does not hard-code Shell-specific prompt content

#### Scenario: App runtime has no memory-pack API

- **WHEN** Shell starts from workspace `/repo`
- **AND** Avatar `shell-assistant` resolves to principal `0xabc...`
- **THEN** Shell may seed the missing `AGENTER.mdx` prompt wrapper under the global Avatar principal root
- **AND** Shell startup does not call or expose an app-runtime memory-pack ensure API
- **AND** Shell startup does not create `/repo/.agenter/avatars/.../memory` for default recording
- **AND** durable ShellAssistant recording is delegated to NoteSystem when the runtime projects a `note` CLI through active `AVATAR_HOME`

#### Scenario: Workspace-private memory remains explicit overlay data

- **WHEN** an app or operator intentionally creates a workspace-private memory asset
- **THEN** it must use the WorkspaceSystem private text asset API with explicit `workspacePath`, `avatarNickname`, and `assetKind=memory`
- **AND** that asset remains a workspace overlay or artifact
- **AND** it is not treated as ShellAssistant's default recording API

#### Scenario: App assistant ensure rejects project workspace authority

- **WHEN** an app ensures an assistant Avatar
- **THEN** the input contract accepts app id, Avatar nickname, display name, and classify metadata
- **AND** it MUST NOT accept `workspacePath` as assistant identity or creation authority

#### Scenario: Runtime clear uses Avatar principal authority

- **WHEN** an app clears an Avatar runtime session
- **THEN** the input contract accepts `avatarPrincipalId`
- **AND** it MUST reject project-shaped `workspacePath + avatarNickname` reset input
- **AND** matching runtime session rows are selected by Avatar principal, not by project workspace path
