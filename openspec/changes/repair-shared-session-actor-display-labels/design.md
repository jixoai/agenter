## Context

`buildActorDirectory(...)` is the shared projection layer that turns auth actors and session-backed identities into UI-facing identity entries. Messages and Terminals both depend on it for selectors, seat lists, and route-level labels.

The current projection only includes sessions while they are `running`, and it uses `session.name` as the primary label. That is not a stable user-facing law. Some runtimes fill `name` with a technical session id, while `avatar` carries the intended human label. Because shared surfaces trust the actor directory, they faithfully render the wrong fact or lose the canonical session label entirely when the runtime stops.

## Goals / Non-Goals

**Goals**

- Prefer human-readable avatar labels for session-backed actors whenever session metadata exposes them.
- Keep session-backed actors resolvable even when the runtime is stopped but the session remains active in the client state.
- Keep the repair shared and orthogonal so every consumer of the actor directory benefits automatically.
- Preserve technical ids or workspace paths as secondary detail for duplicate-label disambiguation.

**Non-Goals**

- Redesign the Room toolbar layout itself.
- Change room or terminal storage schemas.
- Rewrite actor identity ownership across auth/session/profile systems.

## Decisions

### Shared actor-directory owns the label repair

The fix belongs in `buildActorDirectory(...)`, not in Messages or Terminals. Feature surfaces already consume the directory as canonical truth, so the right law is to upgrade the projection once and let the change emerge everywhere.

### Session-backed identity remains available for active stored sessions

The actor directory will include any session whose `storageState` remains active, instead of filtering down to `running` sessions only. This matches the UI law already used by avatar navigation: a stopped avatar session is still a real identity surface.

### Session label preference is `avatar -> name -> id`

For session-backed actors, the actor directory will use `session.avatar` as the primary label when it is present and non-empty. If no avatar label exists, it will fall back to `session.name`, then `session.id`.

### Secondary detail remains available for disambiguation

The actor directory will keep workspace or actor id detail in `subtitle`, and feature surfaces will continue to use their existing duplicate-label disambiguation paths. This avoids collapsing distinct sessions into an indistinguishable selector even after the primary label becomes human-readable.

## Risks / Trade-offs

- [Risk] Multiple running sessions may share the same avatar label. -> Mitigation: existing subtitle/disambiguation paths remain intact.
- [Risk] Some sessions may not expose `avatar`. -> Mitigation: the projection still falls back to `session.name`, then `session.id`.
- [Risk] Including stopped but active sessions could increase selector noise. -> Mitigation: the directory still filters out non-active storage states, and feature surfaces already own their duplicate-label disambiguation.
- [Risk] A feature may have accidentally depended on the opaque session name. -> Mitigation: targeted Messages and Terminals verification will catch regressions in selectors and seat lists.
