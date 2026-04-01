## Context

Chat should be a channel view over message-system, not a mixed projection of attention internals and tooling traces. Existing message records are too generic and cannot represent channel-native system errors or guided interactive prompts.

## Goals / Non-Goals

**Goals**
- Make message-system the single owner of Chat-visible records.
- Support typed channel messages (`text/error/interactive`).
- Add explicit admin API for error message injection.
- Keep interactive v1 simple and operational.

**Non-Goals**
- Preserve legacy untyped message schema.
- Build a full workflow/form engine in v1 interactive messages.
- Keep Chat-side tool-call/tool-result transcript rendering.

## Decisions

### Typed message model in message-system

`MessageRecord` becomes a discriminated union with:

- `kind: "text"`
- `kind: "error"` with `error` payload
- `kind: "interactive"` with `interactive` payload

Persisted message rows store `kind` + `payload_json` so transport and history paging stay consistent.

### Dedicated send APIs by intent

- `message.send` remains the normal text send path (member+).
- `message.sendError` is admin-only for explicit operational/system error notices.
- `message.sendInteractive` sends interactive payload cards (member+).

### Web chat rendering contract

`web-chat-view` renders by message kind:

- `text`: normal conversation bubble
- `error`: system/error card in transcript
- `interactive`: lightweight form card

Interactive v1 submit behavior: collect field values and send one normal text message.

### Chat route simplification

Remove tool-invocation transcript rendering branches from Chat-specific message bubble paths. Technical tooling stays in Devtools.

## Risks / Trade-offs

- Schema migration needs safe defaults (`text`) for old rows.
- Interactive payload validation must be strict enough to avoid malformed cards.
- Admin-only error path needs clear permission errors to prevent silent failures.

## Migration Plan

1. Extend message DB schema + types for message kinds and payload.
2. Add control-plane/API methods for `sendError` and `sendInteractive`.
3. Wire app-server kernel/runtime/controller methods.
4. Update web-chat-view typed rendering + interactive submit bridge.
5. Remove Chat tool-rendering branches and update tests.
