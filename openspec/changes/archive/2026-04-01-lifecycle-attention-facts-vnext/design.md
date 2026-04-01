## Architecture Notes

### 1. Lifecycle event policy

- Lifecycle commits stay append-only facts, but only a subset becomes unresolved attention debt.
- Active lifecycle events use low strength `score=1`.
- Passive lifecycle facts use `score=0` and remain queryable in context history.

### 2. Message channel lifecycle

- `channel_create`, `channel_update`, and `channel_archive` become active attention facts.
- `channel_focus` remains passive because focus changes are routing hints, not mandatory work.

### 3. Terminal lifecycle

- `terminal_create`, `terminal_delete`, and `terminal_config_update` become active attention facts.
- `terminal_focus` and `terminal_unfocus` remain passive.
- Focus changes must record both sides of the transition, not only the terminals that remain focused afterward.

### 4. Control-plane config context

- Terminal control-plane config changes do not belong to any one terminal instance.
- Runtime uses a dedicated attention context id: `ctx-terminal-control-plane`.

### 5. Boot-time behavior

- Runtime startup and hydration do not backfill lifecycle commits for already-existing boot resources.
- Only explicit runtime mutations emit the new lifecycle facts.
