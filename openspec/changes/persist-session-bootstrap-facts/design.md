## Context

`SessionRuntime.start()` currently initializes durable prompt-window state through `ensurePromptWindowStateInitialized()`. When the prompt window is empty, `SessionDb.savePromptWindow()` only updates `session_head.current_prompt_window_id` and writes no `message_part` rows. That creates a dangling prompt-window pointer, leaves fresh `session.db` files with no durable rows beyond `session_head`, and forces later code to infer that “missing prompt-window rows” means “empty prompt window”.

The goal is to keep the ledger model intact: session durability still lives in grouped `message_part` rows plus `ai_call` rows, but bootstrap prompt-window state must also be representable as a first-class durable fact.

## Goals / Non-Goals

**Goals:**
- Persist an explicit durable fact for an empty prompt window.
- Make `getCurrentPromptWindow()` reconstruct an empty prompt window from that durable fact.
- Keep per-request prompt message linkage accurate by excluding bootstrap-only placeholder rows from request message id lists.
- Cover the behavior with unit and integration regression tests.

**Non-Goals:**
- Do not add synthetic Heartbeat chat rows just to make the UI non-empty.
- Do not redesign request-side auxiliary persistence in this change.
- Do not change the public chat or model-call APIs.

## Decisions

### Persist empty prompt windows as a prompt-window state row

`SessionDb.savePromptWindow()` will write a single `scope=prompt_window` message when `messages` is empty. That row will use a dedicated `partType` so the ledger contains a real durable fact instead of only a head pointer.

Why this over leaving the head pointer alone:
- A pointer without any ledger row is not self-describing durable truth.
- Cold inspection and debugging become simpler when every `current_prompt_window_id` resolves to at least one row.

Why this over reviving a separate `prompt_window_state` table:
- The current platform law is that session durability lives in `message_part` and `ai_call`.
- Reintroducing a side table would fragment the ledger again.

### Treat bootstrap rows as state, not as prompt messages

Prompt-window restoration will ignore bootstrap-only rows when rebuilding the user/assistant/system message array. That means `getCurrentPromptWindow()` still returns `messages: []`, while the durable ledger keeps one explicit row proving that the empty window exists.

Why this over pretending the bootstrap row is a system prompt message:
- The bootstrap row is infrastructure state, not AI-visible content.
- Turning it into a normal prompt message would pollute prompt reconstruction and request linkage.

### Exclude bootstrap rows from AI-call request message ids

When `SessionRuntime.handleModelCall()` links prompt-window messages into `request_message_ids`, it will skip bootstrap-only prompt-window rows. The request envelope should only point at real prompt messages that were actually part of the model context.

Why this over including the bootstrap row:
- The row is durable state, not part of the provider-visible `messages` array.
- Keeping it out preserves a clean distinction between context content and ledger scaffolding.

## Risks / Trade-offs

- [Bootstrap row leaks into generic prompt-window readers] → Centralize the filtering rule in `SessionDb.getPromptWindow()` and add regression tests around request message id linkage.
- [Future tooling assumes every prompt-window row is a real message] → Use a dedicated `partType` with explicit test coverage so downstream code can distinguish state rows from message rows.
- [Fresh session DBs remain “too empty” for UI expectations] → This change only fixes the durable fact model. UI surfaces still need their own follow-up change to render bootstrap state meaningfully.
