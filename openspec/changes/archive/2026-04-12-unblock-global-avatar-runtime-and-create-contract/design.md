## Context

This change is correcting the platform authority, not just patching one API.

Repository facts:

- canonical avatar filesystem law already moved toward `by-principal` roots plus `by-nickname` aliases, but runtime resolution still assumes every nickname path is already a symlink
- `@agenter/profile-service` already owns managed principals, principal metadata, and public icon projection
- `PrincipalKind` already includes `avatar`, `room`, and `terminal`, which means Avatar identity is already partially modeled as a keyed entity in the platform
- current `app-server` global avatar catalog is still nickname/filesystem-centric
- current fallback avatar/profile artwork is deterministic, but it does not yet use nullable classification metadata to improve recognizability

The user clarified the intended law:

- Avatar creation is an AuthSystem capability
- keyed entities include at least Room / Terminal / Avatar today, and Workspace should follow the same law later
- default avatar artwork should be generated from address-derived identity, not from arbitrary frontend-owned placeholders
- AuthSystem metadata may carry nullable `classify`, which the backend can map to a lucide-style foreground icon

## Goals / Non-Goals

**Goals**

- Preserve principal-keyed canonical storage as the only durable truth.
- Let runtime launch survive legacy nickname directories by tolerating or migrating them before use.
- Make global avatar creation an AuthSystem-backed capability instead of an app-server-local truth.
- Return avatar catalog entries that are keyed by durable identity, while still exposing nickname as an asset alias/display field.
- Make backend-generated default avatar artwork deterministic from avatar identity and optionally more recognizable via `classify`.

**Non-Goals**

- Do not reintroduce nickname-keyed canonical storage.
- Do not force frontend to perform filesystem migration or storage probing.
- Do not overload workspace copy/fork mutations to masquerade as global-avatar creation.
- Do not solve the missing `workspace` principal kind in this change; acknowledge it as a follow-up law gap without baking more nickname-centric contracts now.

## Decisions

### Decision: Legacy nickname directories need a backend migration bridge

The canonical storage law is still correct: principal-keyed roots are truth and nickname paths are aliases. The failure is assuming every existing installation already matches that law.

Chosen approach:

- On alias resolution or session/runtime creation, detect whether `by-nickname/<nickname>` is a symlink, canonical alias, or legacy directory.
- If legacy layout is detected, migrate or normalize it into canonical `by-principal/<principalId>` plus `by-nickname/<nickname>` alias form before continuing.
- Keep frontend unaware of storage-shape differences.

Rejected alternative:

- Preserve a hard symlink-only resolver and ask frontend or users to repair directories manually.
  - This leaks storage-law migration into unrelated UX flows and blocks runtime creation for existing users.

### Decision: Global avatar creation belongs to AuthSystem

The durable event is not "a nickname folder exists". The durable event is "AuthSystem minted an avatar principal and exposed a public projection for it."

Chosen approach:

- Create global avatars by minting a managed principal with `kind: "avatar"` through AuthSystem/profile-service.
- Store public avatar metadata on that principal, with at least:
  - `nickname`
  - optional `displayName`
  - optional nullable `classify`
- App-server may expose a convenience mutation/query, but only as a bridge to AuthSystem. It must not become a second avatar identity authority.
- Frontend-facing catalog rows must return a stable avatar identity (`avatarPrincipalId` or equivalent durable ID), plus nickname, public metadata, and opaque `iconUrl`.

Rejected alternative:

- Treat nickname directories or workspace copy/fork flows as the durable source of avatar identity.
  - This keeps identity truth in the wrong layer and makes frontend couple itself to filesystem shape.

### Decision: Default avatar artwork is address-seeded and metadata-assisted

The default avatar is a backend-rendered projection of avatar identity, not a frontend-owned placeholder.

Chosen approach:

- Use the avatar principal address / principal ID / stable public-key-derived seed as the deterministic basis for fallback artwork.
- Keep uploaded assets as the highest-precedence icon source.
- If metadata includes `classify`, map it to a canonical lucide-style foreground SVG icon and layer it over the deterministic background art.
- If `classify` is null, keep the deterministic fallback valid without requiring a foreground icon.

Rejected alternative:

- Put `classify` or fallback rendering logic in frontend-only state.
  - This creates a second renderer law and makes media projection drift across clients.

### Decision: Workspace principal law is acknowledged but deferred

The user-level law says keyed entities include Workspace too, but current `PrincipalKind` does not yet expose `workspace`.

Chosen approach:

- Do not block this change on introducing workspace principals.
- Do document the gap so we do not accidentally entrench nickname-or-path-based identity as the long-term model.

## Risks / Trade-offs

- [Risk] Legacy migration may uncover malformed user-created directory states.
  - Mitigation: normalize supported legacy cases automatically and emit precise backend errors for unrecoverable states.
- [Risk] Current frontend code may still key tabs and local state by nickname.
  - Mitigation: expose principal-backed identity in the new contract and warn frontend not to treat nickname as the durable primary key.
- [Risk] `classify` enum design could sprawl into business-specific labels.
  - Mitigation: keep it nullable, controlled, and identity-scoped; only use it for backend icon projection hints.
- [Risk] Workspace principal remains a known gap.
  - Mitigation: track it as follow-up platform work, but stop adding new contracts that depend on nickname/filesystem identity now.
