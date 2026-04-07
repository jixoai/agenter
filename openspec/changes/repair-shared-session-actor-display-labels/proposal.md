## Why

Shared actor-facing surfaces still leak technical runtime identifiers into the primary UI. In the Room toolbar, the current `View as` title can show an opaque session UUID even when the same running avatar already has a human label such as `jane`. The same shared actor directory also feeds terminal selectors and seat lists, so the bug is not local to Messages.

This is a shared identity-presentation defect. The platform already has a better truth source: session-backed actors expose stable avatar/session metadata, but the actor directory currently drops non-running sessions and also prefers the technical `name` even when the avatar label exists.

## What Changes

- Repair the shared actor-directory projection so session-backed actors remain resolvable from active session metadata even when the runtime is stopped, and prefer the human avatar label when one exists.
- Keep technical ids and workspace details as secondary disambiguation facts rather than primary labels.
- Verify the repaired law through focused actor-directory tests and browser walkthroughs of Messages Room and Terminal actor surfaces.

## Capabilities

### Modified Capabilities

- `message-system-surface`: Room viewer presentation should show the current `View as` user label instead of an opaque runtime session identifier.
- `terminal-system-surface`: terminal seat and `call as` presentation should prefer the same human-readable actor label law.

## Impact

- `packages/webui/src/lib/features/collaboration`
- `packages/webui/src/lib/features/messages`
- `packages/webui/src/lib/features/terminals`
- `openspec/specs/message-system-surface/spec.md`
- `openspec/specs/terminal-system-surface/spec.md`
