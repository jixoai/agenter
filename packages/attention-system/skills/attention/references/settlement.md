# Attention settlement

Use `attention` to model obligation state, not to fake progress.

Common flow:

1. `attention list`
2. Copy the active `contextId`
3. `attention query '{"query":"..."}'` if you still need context
4. `attention commit '{"contextId":"ctx-...","summary":"...","done":true}'`

Rules:

- If a round woke only because of attention metadata, inspect the relevant context first.
- Use `done: true` when the context is actually complete.
- Use explicit `scores` only when you intentionally want non-default score changes.
- `attention commit --help` is the source of truth for the current JSON contract.
- `summary` is required. Keep it short and factual.
- The normal closing move after a verified delivery is: send the durable reply first, then commit `done: true` for the same context.
- If another participant or relay room still owes the missing fact, the context is still open; do not use `done: true` yet.
- For relay requests, "asked gaubee" or "waiting for reply" is progress, not completion. Completion starts only after the origin room has the delivered answer.

Example:

```bash
attention list
attention commit '{"contextId":"ctx-room-123","summary":"Sent APP-UPDATED in the origin room after verifying the URL.","done":true}'
```
