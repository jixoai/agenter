# client-runtime-store Specification

## Purpose
Define the durable client-side runtime normalization, long-history paging contract, and Welcome access-state derivation across workspaces, running avatars, and global resources.
## Requirements
### Requirement: Client runtime store SHALL normalize the terminal contract without losing set semantics
The client runtime store SHALL normalize workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment bindings as first-class resource maps. It SHALL NOT collapse those resources back into session-owned `*BySession` stores as the primary identity axis, and it SHALL continue to preserve terminal focus-set semantics. For global terminals, the normalized projection SHALL preserve render-critical facts such as absolute cwd, renderer metadata, durable snapshot hydration state, and live transport URL across refresh and incremental updates.

#### Scenario: Store receives global resources plus running avatars
- **WHEN** the runtime store ingests snapshots containing workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment metadata
- **THEN** it preserves workspace ids, avatar/session ids, room ids, terminal ids, and workspace avatar catalogs as distinct primary identities
- **THEN** selectors can derive workspace and running-avatar views without copying those resources into session-owned authority maps

#### Scenario: Avatar catalog subscription updates one workspace
- **WHEN** the store receives an avatar catalog invalidation event for one workspace path
- **THEN** it updates only that workspace avatar catalog entry map
- **THEN** unrelated workspace catalogs remain unchanged

#### Scenario: Global terminal render facts survive refresh
- **WHEN** the browser refreshes while a global terminal is selected
- **THEN** the normalized terminal entry still carries its absolute cwd, latest durable snapshot, and transport URL after hydration
- **THEN** route consumers do not need a second ad hoc refetch to render the terminal again

### Requirement: Client runtime store SHALL track reverse-time paging state per long-history resource
The client runtime store SHALL maintain explicit reverse-time page state for each long-history global resource and each long-history running-avatar detail resource, and SHALL hydrate only recent windows by default.

#### Scenario: Paging workspace history is independent from room history
- **WHEN** the client prepends an older page for workspace history
- **THEN** the workspace-history cursor advances for that workspace target only
- **THEN** room or terminal history cursors remain unchanged

#### Scenario: Running-avatar detail paging stays runtime-scoped
- **WHEN** the client loads older cycle or model-call history for a running-avatar detail shell
- **THEN** the resource window for that running avatar expands according to its own cursor
- **THEN** unrelated workspace history, room history, or terminal history windows are not mutated

#### Scenario: Persisted history replaces equivalent runtime chat rows
- **WHEN** `runtime.snapshot` already contains in-memory chat rows and `chat.list` later hydrates the same messages with persisted ids
- **THEN** the client runtime store collapses those semantic duplicates into one row per message
- **THEN** the persisted record wins over the in-memory runtime copy

### Requirement: Client runtime store SHALL keep bounded windows for long-list resources
The client runtime store SHALL maintain bounded in-memory windows for workspace history, room timelines, terminal activity, and running-avatar detail resources, and SHALL keep pagination state separate from the visible list projection.

#### Scenario: Recent windows stay hydrated without loading full history
- **WHEN** a route hydrates a workspace history list, room timeline, terminal activity list, or running-avatar detail history
- **THEN** the store keeps only the configured recent window in memory by default
- **THEN** older history remains available through explicit pagination state instead of eager full hydration

#### Scenario: Loading older pages does not duplicate the visible window
- **WHEN** the store prepends older pages for a workspace, room, terminal, or running-avatar detail resource
- **THEN** existing rows are not duplicated
- **THEN** the resource window remains bounded according to the shared controller policy

### Requirement: Client runtime store SHALL derive Welcome access state from current catalogs and avatar-local credential validation
The client runtime store SHALL derive `Welcome` room and terminal access state from the current global catalogs plus the validation outcome of any avatar-local room or terminal credential for the target AvatarSession. It SHALL distinguish at least `joined`, `available`, and `credential-invalid`, and it SHALL NOT require a separate durable Welcome preset or draft stack to remember prior selections.

#### Scenario: Welcome selection reflects current validated joins
- **WHEN** the client hydrates `Welcome` for a workspace and avatar target
- **THEN** the selected rooms and terminals are derived from the current catalogs plus currently valid avatar-local credentials for that AvatarSession
- **THEN** the UI reflects joined state without inventing a second remembered preset model

#### Scenario: Invalid credential remains visible as an explicit invalid state
- **WHEN** a previously stored room or terminal token fails validation during hydration
- **THEN** the runtime store does not treat that room or terminal as joined
- **THEN** the corresponding room or terminal remains visible with a `credential-invalid` state while the stale credential record is preserved until a fresh credential replaces it
