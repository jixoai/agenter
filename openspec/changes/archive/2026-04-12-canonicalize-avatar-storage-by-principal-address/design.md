## Context

The current backend refactor already separated `AvatarRuntime`, `WorkspaceSystem`, and `AttentionContext`, but avatar storage still leaks the old application-layer identity law:

- global avatar roots resolve to `~/.agenter/avatars/<nickname>`
- workspace-private avatar roots resolve to `<workspace>/.agenter/avatars/<nickname>`
- seat files are stored inside those nickname folders
- workspace avatar catalog discovery reads directory names directly as nicknames

That means the durable folder name is still the alias, not the identity.

## Decision

Replace avatar storage with a two-layer filesystem contract:

- canonical root: `.../avatars/by-principal/<principalId>/`
- alias root: `.../avatars/by-nickname/<nickname> -> ../by-principal/<principalId>`

This applies to:

- global avatar storage under `~/.agenter`
- workspace-private avatar storage under `<workspace>/.agenter`

`nickname` remains the human-facing lookup key, but every durable asset root and seat document must live under the canonical `by-principal` directory.

## Detailed Design

### 1. Global avatar resolution

- `resolveGlobalAvatarsRoot()` now returns the canonical `by-principal` container.
- nickname lookup uses a new `by-nickname` alias container.
- `resolveAvatarSources()` continues to accept `nickname`, but the resolved path must point to the canonical principal root when an alias exists.

### 2. Workspace-private avatar resolution

- workspace-private canonical roots move to `<workspace>/.agenter/avatars/by-principal/<principalId>`.
- workspace nickname aliases live under `<workspace>/.agenter/avatars/by-nickname/<nickname>`.
- published workspace asset roots must expose the canonical principal directory, not the nickname alias.

### 3. Seat persistence provisions aliases

- seat writes are the place where a principal is guaranteed to exist.
- whenever a seat document with `principalId` is written, backend code provisions:
  - the canonical principal directory
  - the nickname symlink alias that points to it
- credential save helpers must ensure a principal exists before they persist room / terminal seat state.

### 4. Catalog discovery reads aliases, not canonical directory names

- avatar catalog listing must enumerate `by-nickname` entries because canonical directories are addresses.
- catalog entries still expose `nickname`, but their `globalPath`, `workspacePrivatePath`, and `effectivePath` must resolve to canonical principal directories.

## Non-Goals

- No migration of legacy nickname-keyed directories.
- No change to runtime/session id law in this change.
- No redesign of room / terminal seat semantics beyond canonicalizing their storage root.

## Risks / Trade-offs

- Existing manual files under legacy nickname paths will no longer be discovered automatically.
- Symlink availability is required for nickname aliases; tests must validate the behavior on supported Unix-like environments.
- Runtime id remains separate from principal identity in this change; that is a future law decision if needed.
