## Architecture Notes

### 1. Read-state belongs to message-system

- Read progress is a property of room collaboration, so it belongs to message-system.
- `app-server` may project or cache that state for runtime consumers, but it must not become the durable owner of room read cursors.
- Attention debt remains a runtime concern and must not be re-labeled as chat read-state.

### 2. One room, many readers

- Every room seat may advance its own read cursor independently.
- The UI needs to compute aggregate progress from those actor-scoped cursors:
  - read
  - unread
  - read timestamp when available
- This is conceptually closer to Feishu or other group messengers than to a single-user AI pending queue.

### 3. Read ring replaces pending strip in room-first UX

- Chat UI should show a compact progress ring or equivalent read-state affordance near the relevant message or room status area.
- Hover, popover, or side inspector may expand that into a seat list with:
  - actor label
  - read/unread status
  - read timestamp
  - credential-invalid or unavailable state when relevant
- This read-state affordance is not a delivery guarantee for AI attention settlement; it is purely room collaboration state.

### 4. Unread notifications remain separate

- Session unread badges in navigation stay useful for app discovery.
- Those badges remain ephemeral runtime projection, not durable room truth.
- The room-local read-state UI must not depend on whether the current tab was visible.

### 5. Orthogonality rule

- message-system owns room read cursors and read-progress projection
- app-server owns session-level unread aggregation for shell navigation
- attention runtime owns AI work debt
- terminal-system and task-system stay unrelated to room read-state

## Verification Slice

This change owns the room collaboration and read-state slice of the BDD matrix.

### Required scenarios

- Room creation, grants, and actor-backed collaboration: scenarios `21-35`
- Room messaging, read-state, and receipts: scenarios `36-50`
- Cross-system room or shell behaviors that depend on durable room truth rather than runtime-only state: scenarios `76-79`, `81-85`, `86-89`, `96-100`

### Required evidence modes

- message-system and app-server integration coverage for room grants, read cursors, and durable projections
- browser coverage for Chats roster, read ring, disclosure, and desktop/mobile unread behavior
- real-model room relay and compact recovery coverage when credentials are available, with explicit skip reporting when not run
