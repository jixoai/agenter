## Context

The runtime shell already has most of the raw building blocks:

- `session.db` persists `heartbeat`, `prompt_window`, and `request_aux` ledger facts.
- `ai_call` persistence keeps request/response snapshots, including assistant text, thinking, and tool trace payloads.
- runtime events already stream `chat.message`, `runtime.modelCall`, and `runtime.modelCall.delta`.
- Svelte WebUI already has a provenance-capable `workspace-settings-panel` built against scoped settings graph contracts.

The regression happened at the projection layer:

- Heartbeat was simplified into `RuntimeChatMessage[]`, which is fine for a conversation surface but too lossy for runtime inspection.
- runtime Settings bound to `readSettings/saveSettings`, which edits one file at a time and bypasses the richer `settings.scope` / `settings.layers` graph already available.

## Decision

### 1. Heartbeat gets a dedicated inspection projection

Do not overload `chat.list` with more runtime-only meaning.

Instead, treat Heartbeat as a composed inspection surface built from three fact sets:

- persisted heartbeat rows
- persisted request auxiliary rows
- persisted/live model-call records plus live model-call deltas

This keeps conversation projection and runtime inspection separate.

### 2. Request auxiliary rows become a first-class runtime contract

Add a paged runtime API for `request_aux` rows so Heartbeat can inspect durable changes to:

- `systemPrompt`
- `tools`
- `config`

These rows remain durable in `message_part`; Heartbeat merely projects them.

### 3. Live model progress stays attached to model-call cards

Heartbeat should not invent a separate "tool trace log" timeline.

Instead:

- persisted `ai_call.response` is the durable history for prior model rounds
- `runtime.modelCall.delta` augments the currently running model-call card with in-flight tool call/result and draft updates

This keeps one causal unit per model call.

### 4. Runtime Settings reuses scoped settings graph, not the single-file editor

Runtime Settings should resolve through the runtime's current scope:

- `scope = global` for `~/`
- `scope = workspace` for concrete workspaces
- `avatar = session.avatar`

The UI should reuse the provenance-capable settings graph panel rather than maintaining a runtime-only editor that cannot explain inheritance.

### 5. Contract-first verification

Testing order must stay explicit:

1. verify backend request-aux paging and runtime settings scope resolution
2. verify client/store projection and merge behavior
3. verify Svelte binding and interaction

Do not use browser/UI tests to prove contract correctness.

## Consequences

- Heartbeat becomes objectively inspectable without turning back into the old cycle dashboard.
- Settings regains provenance and layer inspection while remaining runtime-scoped.
- The shell keeps clear boundaries:
  - chat projection is for conversation
  - heartbeat inspection is for runtime facts
  - settings inspection is for effective runtime configuration

