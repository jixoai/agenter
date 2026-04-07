## Context

`buildActorDirectory(...)` is the shared projection layer that turns auth actors and running sessions into UI-facing identity entries. Messages and Terminals both depend on it for selectors, seat lists, and route-level labels.

The current projection for running sessions uses `session.name` as the primary label. That is not a stable user-facing law. Some runtimes fill `name` with a technical session id, while `avatar` carries the intended human label. Because shared surfaces trust the actor directory, they faithfully render the wrong fact.

## Goals / Non-Goals

**Goals**

- Prefer human-readable avatar labels for session-backed actors whenever runtime state exposes them.
- Keep the repair shared and orthogonal so every consumer of the actor directory benefits automatically.
- Preserve technical ids or workspace paths as secondary detail for duplicate-label disambiguation.

**Non-Goals**

- Redesign the Room toolbar layout itself.
- Change room or terminal storage schemas.
- Rewrite actor identity ownership across auth/session/profile systems.

## Decisions

### Shared actor-directory owns the label repair

The fix belongs in `buildActorDirectory(...)`, not in Messages or Terminals. Feature surfaces already consume the directory as canonical truth, so the right law is to upgrade the projection once and let the change emerge everywhere.

### Session label preference is `avatar -> name`

For running sessions, the actor directory will use `session.avatar` as the primary label when it is present and non-empty. If no avatar label exists, it will fall back to `session.name`.

### Secondary detail remains available for disambiguation

The actor directory will keep workspace or actor id detail in `subtitle`, and feature surfaces will continue to use their existing duplicate-label disambiguation paths. This avoids collapsing distinct sessions into an indistinguishable selector even after the primary label becomes human-readable.

## Risks / Trade-offs

- [Risk] Multiple running sessions may share the same avatar label. -> Mitigation: existing subtitle/disambiguation paths remain intact.
- [Risk] Some sessions may not expose `avatar`. -> Mitigation: the projection still falls back to `session.name`.
- [Risk] A feature may have accidentally depended on the opaque session name. -> Mitigation: targeted Messages and Terminals verification will catch regressions in selectors and seat lists.
