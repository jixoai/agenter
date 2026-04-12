## 1. Storage Migration Bridge

- [x] 1.1 Define the legacy nickname-alias tolerance/migration requirement in the avatar management spec delta.
- [ ] 1.2 Update avatar alias resolution so legacy non-symlink nickname directories no longer block runtime/session creation.
- [ ] 1.3 Add regression coverage for legacy global avatar alias directories and automatic normalization behavior.

## 2. AuthSystem Avatar Principal Contract

- [x] 2.1 Define avatar-principal creation and projection requirements in the identity-control-plane and workspace-avatar spec deltas.
- [ ] 2.2 Implement profile-service and app-server bridge support for creating a managed principal with `kind: "avatar"` and returning a principal-backed catalog entry.
- [ ] 2.3 Update public client/runtime-store contracts so frontend keys global avatars by durable identity, with nickname treated as display/storage alias.

## 3. Avatar Media Fallback Law

- [x] 3.1 Define `classify` metadata and address-seeded fallback rendering in the identity-media-assets spec delta.
- [ ] 3.2 Implement backend fallback icon rendering that maps `classify` to a canonical lucide-style foreground SVG icon while keeping deterministic identity-seeded background art.
- [ ] 3.3 Add regression coverage for classify/null fallback cases and uploaded-asset precedence.

## 4. Verification

- [ ] 4.1 Re-run affected profile-service, app-server, and client-sdk tests.
- [ ] 4.2 Sync durable specs and frontend-facing contract notes after implementation stabilizes.
