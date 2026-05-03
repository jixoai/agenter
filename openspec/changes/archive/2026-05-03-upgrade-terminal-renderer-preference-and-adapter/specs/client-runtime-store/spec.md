## MODIFIED Requirements

### Requirement: Client runtime store SHALL normalize the terminal contract without losing set semantics

The client runtime store SHALL normalize workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment bindings as first-class resource maps. It SHALL NOT collapse those resources back into session-owned `*BySession` stores as the primary identity axis, and it SHALL continue to preserve terminal focus-set semantics. For global terminals, the normalized projection SHALL preserve render-critical facts such as absolute cwd, renderer preference metadata, resolved renderer facts, durable theme metadata, durable snapshot hydration state, and live transport URL across refresh and incremental updates.

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
- **THEN** the normalized terminal entry still carries its absolute cwd, latest durable snapshot, renderer preference metadata, resolved renderer facts, theme metadata, and transport URL after hydration
- **THEN** route consumers do not need a second ad hoc refetch to render the terminal again
