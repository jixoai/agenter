## Architecture Notes

### 1. Root auth remains owned by profile-service

- `profile-service` stays the only durable owner of root-auth key material and canonical auth identity.
- `app-server` may discover, proxy, or bootstrap against that authority, but it must not copy the key into a second store or invent a parallel auth bootstrap format.
- The UI requirement from this change is explicit productization, not new key ownership.

### 2. Superadmin onboarding becomes an app-level gate

- If the client has no valid stored auth session, the app enters a dedicated onboarding flow instead of silently dropping the user into a half-configured workbench.
- The onboarding flow exposes two explicit paths:
  - import/bind an existing root private key
  - call a backend mutation that generates or reveals the backend-managed root private key, then pre-fills the local input
- The onboarding flow is not buried inside Settings. Settings remains a maintenance surface after onboarding succeeds.

### 3. Auth actor catalog is the shared identity projection

- Collaboration-facing surfaces need a stable actor catalog that answers:
  - `actorId`
  - public label
  - actor kind (`auth`, `session`, `virtual`)
  - icon URL
  - availability / credential state when relevant
- This catalog is an auth/profile projection. It is not a room membership table and not a terminal grant table.
- Message-system and terminal-system still own their own grants, tokens, admin groups, and presence. They only reference actor ids from the auth actor catalog.

### 4. Collaboration surfaces stop inventing durable humans

- Room users panels, terminal users panels, and actor pickers must stop pretending that a freeform `label + accessToken` tuple is a durable human profile.
- Human-facing seats should resolve through the auth actor catalog whenever they are durable people.
- Session actors may still exist as separate seats, but they must be explicitly labeled as session actors instead of being collapsed into auth actors.

### 5. Icon ownership stays upstream

- Random avatar artwork, uploaded icons, and deterministic fallback icons continue to resolve through profile-service-backed media endpoints.
- WebUI may cache or display those URLs, but it must not become the icon owner.
- This directly addresses the current regression where newly created users lose the expected auth-backed random avatar behavior.

### 6. Orthogonality rule

- `auth-system` owns identity, auth sessions, public profile metadata, and actor icon projection.
- `message-system` owns room truth, grants, room-scoped credentials, and room history.
- `terminal-system` owns terminal truth, grants, terminal-scoped credentials, focus, and approval state.
- `task-system` remains out of scope and must not be reintroduced as an accidental dependency of the onboarding or actor-catalog flow.

## Verification Slice

This change owns the auth and identity slice of the BDD matrix.

### Required scenarios

- Auth bootstrap and onboarding: scenarios `1-10`
- Auth actor catalog and avatars: scenarios `11-20`
- Cross-system consistency checks that depend on one durable auth actor being reused across room and terminal surfaces: scenarios `76-77`, `84-85`, `98-100`

### Required evidence modes

- backend unit and integration coverage for bootstrap status, key generation or reveal, and actor catalog projection
- browser dogfood on desktop and mobile for onboarding entry, key generation button, auth restore, and actor-backed avatar rendering
- explicit reporting when real auth bootstrap depends on external auth authority behavior
