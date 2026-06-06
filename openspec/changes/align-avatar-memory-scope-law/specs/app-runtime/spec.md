## MODIFIED Requirements

### Requirement: App packages SHALL initialize assistant resources through generic APIs

The app runtime SHALL let apps ensure Avatar, global prompt-source, and app-owned global Avatar memory-pack resources through generic app APIs. App packages SHALL provide app defaults, but core runtime modules SHALL remain app-agnostic and prompt/memory files SHALL remain openly editable user assets. App-owned default prompt and memory-pack resources SHALL be addressed by the Avatar principal id under the global Avatar canonical root, not by a project workspace path or nickname alias. WorkspaceSystem private text assets remain available only for explicitly workspace-scoped private artifacts and overlays; they MUST NOT be the default target for app-owned assistant identity memory.

#### Scenario: App ensures default assistant without core special case

- **WHEN** Shell needs default Avatar `shell-assistant`
- **THEN** it requests Avatar ensure through a generic Avatar/app API
- **AND** it may create missing app-owned prompt and memory defaults through generic principal-addressed app APIs
- **AND** core launcher modules do not hard-code the `shell-assistant` nickname

#### Scenario: App prompt initialization stays open and seed-if-missing

- **GIVEN** an app-owned default prompt resource already exists for an Avatar
- **WHEN** Shell runs its initialization flow
- **THEN** it reads the existing file as current truth
- **AND** it creates the missing prompt without locking or automatically restoring app defaults over user edits
- **AND** advanced users may edit the prompt resource manually

#### Scenario: App memory-pack initialization stays open and seed-if-missing

- **GIVEN** an app-owned default memory role file already exists under the Avatar principal root
- **WHEN** Shell runs its initialization flow from any project workspace
- **THEN** it reads the existing global Avatar memory file as current truth
- **AND** it creates missing memory role files without locking or automatically restoring app defaults over user edits
- **AND** advanced users may edit those memory resources manually

#### Scenario: App memory pack ignores project workspace locality

- **GIVEN** Shell starts from workspace `/repo`
- **AND** Avatar `shell-assistant` resolves to principal `0xabc...`
- **WHEN** Shell seeds the missing assistant memory pack
- **THEN** each default role file is seeded under `~/.agenter/avatars/by-principal/0xabc.../memory/`
- **AND** the app memory-pack seed contract does not expose `/repo` as the memory root input
- **AND** Shell startup does not create `/repo/.agenter/avatars/.../memory` for the default app-owned memory pack

#### Scenario: Workspace-private memory remains explicit overlay data

- **WHEN** an app or operator intentionally creates a workspace-private memory asset
- **THEN** it must use the WorkspaceSystem private text asset API with explicit `workspacePath`, `avatarNickname`, and `assetKind=memory`
- **AND** that asset remains a workspace overlay or artifact
- **AND** it is not treated as the default app-owned identity memory pack

#### Scenario: Legacy memory seed input rejects project workspace authority

- **WHEN** a caller tries to seed the default app memory pack with `workspacePath` instead of `avatarPrincipalId`
- **THEN** the app memory-pack seed schema rejects that input
- **AND** the caller must use the principal-addressed global Avatar memory contract

#### Scenario: App assistant ensure rejects project workspace authority

- **WHEN** an app ensures an assistant Avatar
- **THEN** the input contract accepts app id, Avatar nickname, display name, and classify metadata
- **AND** it MUST NOT accept `workspacePath` as assistant identity or creation authority

#### Scenario: Runtime clear uses Avatar principal authority

- **WHEN** an app clears an Avatar runtime session
- **THEN** the input contract accepts `avatarPrincipalId`
- **AND** it MUST reject project-shaped `workspacePath + avatarNickname` reset input
- **AND** matching runtime session rows are selected by Avatar principal, not by project workspace path

#### Scenario: App memory seed rejects non-principal paths

- **WHEN** a caller passes a non-principal path-like value as `avatarPrincipalId`
- **THEN** the app memory-pack seed route rejects the input before filesystem mutation
- **AND** no workspace-local memory file is created as a fallback
