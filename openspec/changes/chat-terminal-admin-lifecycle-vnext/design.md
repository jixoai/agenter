## Architecture Notes

### 1. Lifecycle ownership

- Chat and terminal lifecycle stay in their own systems.
- Session runtime publishes lifecycle facts into attention via a shared helper (`source=lifecycle`, score 0).
- Lifecycle attention is append-only and not used as mutable UI state.
- Lifecycle commits are queryable facts, not unresolved debt; they must not keep LoopBus spinning.

### 2. Chat channel lifecycle

- `archive` is hide-only (soft delete): channel stays queryable by `includeArchived=true`.
- `chat-main` (and built-in channels) are protected from archive.
- Access token behavior:
  - frontend may provide hint/prefilled token.
  - backend validates format and accepts if valid.
  - backend auto-generates when missing.

### 3. Terminal lifecycle

- Runtime exposes `list/create/focus/delete` wrappers over terminal control-plane.
- UI no longer treats terminal selection as visual-only; focus action calls backend API.
- Delete removes runtime terminal instance and publishes lifecycle attention item.

### 4. Quick Start configuration

- Quick Start keeps current entry flow but adds two admin controls:
  - room metadata editor (`chat-main` defaults)
  - boot terminal editor (add/edit/remove descriptors)
- Config persists in workspace local settings layer and is consumed by next session startup through `resolveSessionConfig`.

### 5. UI stability

- Metadata editors use explicit labels (no placeholder-as-label).
- Participant row identity uses stable keys to avoid input blur/remount regression.

### 6. Model-side message tooling

- Message-system exposure to model tools includes:
  - `message_channel_list` for channel discovery and metadata lookup.
  - `message_channel_get` for per-channel metadata/context lookup.
  - `message_send` for user-visible dispatch.
- Chat lifecycle commits (`channel_create/update/focus/archive/grant`) include structured channel payloads so attention context stays self-descriptive.
