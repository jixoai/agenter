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
4. When the real work is finished, run `attention commit` with JSON `stdin`.

Key laws:
- `score > 0` means the obligation still exists.
- `done: true` is the normal way to resolve the active scores for a context.
- Lower scores only after the real work has actually happened.
- For `attention query` and `attention commit` through `root_workspace_bash`, default to JSON `stdin`; only use argv JSON when the payload is trivially short.
- For a simple single-room delivery task, do not interrupt the first action just to inspect attention if the current room already states the work clearly.
- If you already sent the required durable reply, verified the file, or confirmed the external side effect, settle the attention in the same round instead of leaving solved work active.
- If the work is still waiting on another participant, relay room, or external source, the obligation is not complete yet and must stay unresolved.
- For relay work, `done: true` becomes legal only after the origin room already received the final answer, not merely an acknowledgement that you are asking someone else.

Common endings:
- Delivery finished and the user already got the result:
  `attention commit '{"contextId":"ctx-...","summary":"Delivered the required reply and verified the result.","done":true}'`
- You need to keep the work open because evidence is still missing:
  leave the context unresolved, gather evidence, and only commit once the real state changed.

References:
- `references/settlement.md`: how to decide whether attention is still active and how to use `commit`
