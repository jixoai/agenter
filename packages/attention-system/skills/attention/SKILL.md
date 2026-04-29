---
name: agenter-attention
description: Inspect and settle obligations. Use this when you need to understand or update attention debt.
---

# agenter-attention

Use this skill when you need to inspect unresolved obligations or record that an obligation has truly progressed.

Quick start:
1. If the current task already names the concrete file, room, terminal, or URL work to do next, do that real work before browsing attention.
2. Run `attention list` only when you need the active `contextId` or need to confirm which obligations still remain.
3. Run `attention query` with JSON `stdin` only if `attention list` is still not enough.
4. When the real work is finished through `root_bash`, keep `command=attention commit` and put the JSON object in the tool-level `stdin` field.

Key laws:
- `score > 0` means the obligation still exists.
- `done: true` is the normal way to resolve the active scores for a context.
- Lower scores only after the real work has actually happened.
- For `attention query` and `attention commit` through `root_bash`, default to the minimal command plus JSON in the tool-level `stdin`; only use argv JSON when you are already inside a plain shell and the payload is trivially short.
- Do not synthesize `stdin` with shell glue such as `echo '{...}' | attention commit` when you control `root_bash`; pass the JSON via the tool's `stdin` field instead.
- If you do choose the plain-shell fallback, pass the JSON directly as one argv object like `attention commit '{...}'`; do not add a redundant `echo`.
- If `attention query --help` or `attention commit --help` marks compact as `Suggested` or `Available`, `--compact` is an optional positional mode. If the positional array becomes unclear, switch back to standard object JSON immediately.
- For a simple single-room delivery task, do not interrupt the first action just to inspect attention if the current room already states the work clearly.
- If you already sent the required durable reply, verified the file, or confirmed the external side effect, settle the attention in the same round instead of leaving solved work active.
- If the work is still waiting on another participant, relay room, or external source, the obligation is not complete yet and must stay unresolved.
- For relay work, `done: true` becomes legal only after the origin room already received the final answer, not merely an acknowledgement that you are asking someone else.

Common endings:
- Delivery finished and the user already got the result:
  ```text
  root_bash.command: attention commit
  root_bash.stdin: {"contextId":"ctx-...","summary":"Delivered the required reply and verified the result.","done":true}
  ```
- Plain-shell fallback only when you are already inside a shell and the payload is trivially short:
  `attention commit '{"contextId":"ctx-...","summary":"Delivered the required reply and verified the result.","done":true}'`
- You need to keep the work open because evidence is still missing:
  leave the context unresolved, gather evidence, and only commit once the real state changed.

References:
- `references/settlement.md`: how to decide whether attention is still active and how to use `commit`
