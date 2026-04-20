---
name: agenter-message
description: Read, query, send, edit, and recall durable room messages. Use this when work depends on room context, room history must be searched, a room expects a protocol-shaped reply, or a chat-related attention item still needs a user-visible reply.
---

# agenter-message

Use this skill when you need to read or query room history, send, edit, or recall a durable room message, or decide whether a chat-related attention item still requires a room reply.

Quick start:
1. If the latest room message already contains the full task and no other room is involved yet, do not reread the room first.
2. If the task already shows the exact room `chatId`, use that literal `chatId` directly for `message send`, `message edit`, `message recall`, or `message read`.
3. Run `message list` once only when you truly need a `chatId` or need to discover another visible room.
4. Run `message read` with JSON `stdin` only when room history may actually change the decision.
5. Run `message query` when you need cross-message lookup, fielded search, or guarded SQL over the rooms you already hold.
6. For temporary cross-room search, prefer `chatId:"*"` so the runtime resolves only the rooms you already have grants for.
7. Decide whether the room needs an acknowledgement, a narrow follow-up question, or a final reply.
8. Send one durable message with the correct room scope and protocol. If you are replying to a specific earlier room message, include `ref`. Through `root_workspace_bash`, prefer `command=message send` plus JSON `stdin`; only use argv JSON for trivial single-line payloads. If `message send --help` marks compact as `Suggested` or `Available`, `message send --compact` is also available for positional payloads.
9. `message send` returns `recentMessages`. Inspect them immediately as a lightweight post-send sanity check.
10. If two of your recent messages look similar, run `message read` before changing history so you can also see `referencedItems` and the nearby reply context.
11. Similar wording alone is not enough to justify recall. Judge the room's actual conversation context first.
12. If the repetition was intentional in the room's protocol or request, keep both messages.
13. If your prior room message is invalid or stale and you already know its `messageId`, prefer `message edit` to correct that durable reply in place.
14. If the earlier durable reply should disappear rather than remain visible with corrected wording, use `message recall` on that `messageId` before sending a replacement.
15. If you cannot safely edit or recall the earlier durable reply, send a corrected replacement.
16. If that reply completes the obligation, switch to `attention` and settle the same context.

Key laws:
- The origin room owns the user-visible conversation.
- For `message read`, `message query`, `message send`, `message edit`, and `message recall` through `root_workspace_bash`, default to JSON `stdin`; only use argv JSON when the payload is trivially small.
- If `message read --help`, `message query --help`, `message send --help`, `message edit --help`, or `message recall --help` marks compact as `Suggested` or `Available`, `--compact` is an optional positional mode. If the positional array becomes unclear, switch back to standard object JSON immediately.
- Use `ref` when the new room message is replying to a specific earlier durable message.
- `message send` returns `recentMessages`; treat them as a quick self-check, not a replacement for a full room read.
- `message read` returns the visible `items` plus one-hop `referencedItems`, so you can inspect nearby reply context before deciding whether to revise room history.
- If the task already gives the exact room `chatId`, that literal room id is enough to send the acknowledgement or final reply; do not rediscover the same room through `message list`.
- `message query` is message-history lookup, not a generic workspace search tool.
- `message query` only sees the room scope you already hold. `chatId:"*"` means "all rooms currently granted to me", not "all rooms in the system".
- Use `mode:"match"` for literal text lookup, `mode:"query"` for structured message filters, and `mode:"sql"` only when the analysis genuinely needs aggregation or projection.
- `mode:"sql"` is read-only and runs on a pre-authorized temporary projection. If the runtime rejects your SQL, tighten the query instead of trying to mutate the dataset.
- If you already have the prior durable reply's `messageId`, `message edit` is the cleanest correction path for your own earlier message.
- If the earlier message should no longer remain visible in the room, `message recall` is the cleanest withdrawal path for your own earlier message.
- If you do not have the `messageId`, or the earlier message belongs to someone else, send a corrected follow-up message instead of guessing.
- Prefer `message edit` when the same room fact should stay visible with corrected content; prefer `message recall` when the prior room fact should be withdrawn before you post a replacement.
- Similar wording alone is not enough to justify recall; decide from the actual room context and whether the repetition was intentional in the room's protocol or request.
- If the current room message already fixes the task, URL, or required reply token, the normal next move is acknowledgement or tool work, not another room read.
- If the room context already exposes `visibleRooms`, those rooms are real durable channels you can use now; a participant missing from the origin room is not automatically unavailable.
- If the user asks you to ask or relay to another participant and a matching visible room already exists, relay there instead of telling the user that the participant is not here.
- If you relay out from the origin room, "I'm asking them now" is only an acknowledgement, not the final delivery.
- Room messages are durable shared truth.
- Chat attention is not finished just because tools succeeded; it finishes when the necessary room reply has been sent.
- If the room will wait through multi-step work, send one short acknowledgement before the deeper tool work starts.
- A good acknowledgement is brief: usually one or two short sentences, not a full requirement recap or numbered execution plan.
- Reply promptly when the room is waiting on you, but do not spam the room with every internal step.
- While another participant or room still owes you the missing fact, keep the origin-room obligation unresolved; do not close it with `attention commit ... done=true` yet.
- After the relay target replies, the next required move is to deliver that answer back into the origin room before settling the attention.
- If the current attention says `self_update` / `no_external_reply_needed`, that usually means you should continue private work or settle the attention, not send another room reply yet.
- Private reminders do not replace the required durable room reply; they usually mean the shared-room obligation is still open.
- Follow the room's requested protocol exactly.
- If the room already fixed a URL, path, or other reply token, preserve that fact exactly instead of silently normalizing it.
- Terminal success alone is not the room reply. Once the exact promised URL or path has been freshly verified, send the required room message before you treat the chat work as done.
- After the required room reply has been sent, the usual next move is `attention list` followed by `attention commit ... done=true`.
- A later feedback message reopens the room obligation; do not settle that new debt until the new room reply has actually been sent.

References:
- `references/room-protocols.md`: room ownership, protocol prefixes, and correction behavior
- `references/chat-attention-items.md`: acknowledgement timing, chat etiquette, and settling chat-related attention items
