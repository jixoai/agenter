# Attention settlement

Use `attention` to model obligation state, not to fake progress.

Common flow:

1. `attention list`
2. Copy the active `contextId`
3. Run `attention query` with JSON `stdin` if you still need context
4. Run `attention commit` with JSON `stdin`

Rules:

- If a round woke only because of attention metadata, inspect the relevant context first.
- Use `done: true` when the context is actually complete.
- Use explicit `scores` only when you intentionally want non-default score changes.
- Through `root_bash`, keep the command itself minimal and put the JSON payload in `stdin` by default.
- If `attention query --help` or `attention commit --help` marks compact as `Suggested` or `Available`, `--compact` is also available for positional payloads; if the array shape becomes unclear, fall back to object JSON immediately.
- `attention commit --help` is the source of truth for the current JSON contract.
- `summary` is required. Keep it short and factual.
- The normal closing move after a verified delivery is: send the durable reply first, then commit `done: true` for the same context.
- If another participant or relay room still owes the missing fact, the context is still open; do not use `done: true` yet.
- For relay requests, "asked gaubee" or "waiting for reply" is progress, not completion. Completion starts only after the origin room has the delivered answer.

Example:

```text
root_bash.command: attention list

root_bash.command: attention commit
root_bash.stdin: {"contextId":"ctx-room-123","summary":"Sent APP-UPDATED in the origin room after verifying the URL.","done":true}
```
