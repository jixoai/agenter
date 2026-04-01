## 1. Room truth cleanup

- [x] 1.1 Normalize room participants in `message-system` create/update paths and reject legacy participant truth from persisting further
- [x] 1.2 Add forward cleanup in app-server bootstrap/reattach paths so old built-in rooms are rewritten with canonical participant truth

## 2. Chats admin surface correction

- [x] 2.1 Stabilize metadata disclosure drafts so passive refresh does not overwrite in-progress source/title/metadata edits
- [x] 2.2 Remove room-global focus actions from the tab row and metadata disclosure, and expose seat-scoped focus actions in the Users panel
- [x] 2.3 Stop using `builtIn` provenance as a front-end delete/archive lock on the global Chats route

## 3. Verification

- [x] 3.1 Add or update message-system and app-server tests for legacy participant cleanup and bootstrap repair
- [x] 3.2 Add or update WebUI unit/story tests for metadata draft preservation, per-seat focus actions, and global room cleanup affordances
- [x] 3.3 Run targeted test suites plus `bun run typecheck`
