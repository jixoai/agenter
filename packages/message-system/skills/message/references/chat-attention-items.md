# Chat-related attention items

Treat chat-related attention items as conversation obligations, not just tool obligations.

Typical cases:

- the room is waiting for an acknowledgement before longer work
- the room expects a protocol-shaped delivery reply
- the room needs one narrow follow-up question to unblock the next step
- a prior room reply became stale after new facts or user feedback
- a later feedback message reopened the room obligation even though you already sent an earlier delivery reply

Good habits:

- have an ending: if you start work in a room, close the loop in that room unless the workflow clearly moved elsewhere
- reply in time: send one short acknowledgement early when work will take time, then send the needed final reply as soon as the evidence is ready
- keep acknowledgements tiny: one or two short sentences is usually enough
- if the request needs multiple steps, send the acknowledgement before you disappear into file writes, terminal work, or retries
- if that acknowledgement or follow-up question may need a later silence check, you may set `followUpAfterMs` on `message send`; expiry creates internal attention, not an automatic room ping
- follow chat etiquette: keep durable room messages concise, human-readable, and scoped to what the room needs
- do not dump your whole plan back into the room: long numbered restatements and checklist echoes are usually wasted tokens, not better coordination
- do not spam: do not narrate every command, retry, or internal thought into the room
- do not skip the necessary reply: successful tools do not replace the room message the user is waiting for
- if you need evidence from prior room history, prefer one `message query` over repeated `message read` paging when the answer is really a search problem
- through `root_bash`, default to `command=message send` plus JSON `stdin`; only use argv JSON for a trivial single-line payload
- through `root_bash`, default to `command=message query` plus JSON `stdin` for room-history search; only use argv JSON for a trivial single-line payload
- if `message send --help` marks compact as `Suggested` or `Available`, `message send --compact` is also available for positional payloads; if the array shape becomes unclear, fall back to object JSON immediately
- if `message query --help` marks compact as `Suggested` or `Available`, `message query --compact` is also available for positional payloads; if the array shape becomes unclear, fall back to object JSON immediately
- `chatId:"*"` only searches rooms already granted to you. It is the right temporary cross-room lookup primitive when you do not know which visible room holds the fact yet.
- if the user asked you to reach another participant and `visibleRooms` already exposes that participant's room, relay there instead of replying that the participant is absent from the current room
- an acknowledgement like "I'll ask them now" is only a waiting-state message; it does not finish the origin room's final delivery
- while you are still waiting on another participant or relay room, do not settle the origin attention with `done: true`
- once the relay answer arrives, the next required step is to send the answer back to the origin room before you close the attention
- keep the promised payload exact: if the room gave a fixed URL, path, or token, reuse that exact fact instead of silently rewriting it
- treat a promised URL as a verified payload, not a plan: do not send it as "ready" until the exact URL or required path already responds
- terminal snapshots, running-process observations, or `terminal write` success are not that proof by themselves; after the exact HTTP check succeeds, send the room reply instead of looping on more terminal inspection
- if the room promised both a root URL and an API path such as `/api/status`, do not send the final reply until both are verifiably live
- treat follow-up feedback as new debt: an earlier `APP-URL` does not satisfy the later `APP-UPDATED` or `APP-RESUMED` reply the room is now waiting for
- treat private reminders as a signal to finish the shared-room obligation, not as a new durable room to answer
- if a teammate only posted progress and you do not yet have a new room-visible fact, treat that as private plan refresh, not as a reason to mirror the same status back into the room

Settlement checklist:

1. Is any room still waiting for a reply from you?
2. If this was a relay, did the origin room already receive the final answer instead of only an acknowledgement?
3. If an earlier message is now wrong or stale, did you send the corrected replacement?
4. Only after that should the related chat attention item be settled.

Typical closing sequence:

```text
root_bash.command: message send
root_bash.stdin: {"chatId":"room-1","content":"APP-UPDATED: http://127.0.0.1:4173/"}

root_bash.command: attention list

root_bash.command: attention commit
root_bash.stdin: {"contextId":"ctx-room-1","summary":"Sent the required APP-UPDATED reply after verification.","done":true}
```
