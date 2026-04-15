---
name: agenter-message
description: Read and send durable room messages. Use this when work depends on room context, a room expects a protocol-shaped reply, or a chat-related attention item still needs a user-visible reply.
---

# agenter-message

Use this skill when you need to read room history, send a durable room message, or decide whether a chat-related attention item still requires a room reply.

Quick start:
1. If the latest room message already contains the full task and no other room is involved yet, do not reread the room first.
2. If the task already shows the exact room `chatId`, use that literal `chatId` directly for `message send` or `message read`.
3. Run `message list` once only when you truly need a `chatId` or need to discover another visible room.
4. Run `message read` with JSON `stdin` only when room history may actually change the decision.
5. Decide whether the room needs an acknowledgement, a narrow follow-up question, or a final reply.
6. Send one durable message with the correct room scope and protocol. Through `root_workspace_bash`, prefer `command=message send` plus JSON `stdin`; only use argv JSON for trivial single-line payloads.
7. If a prior room message is invalid or stale, send a corrected replacement.
8. If that reply completes the obligation, switch to `attention` and settle the same context.

Key laws:
- The origin room owns the user-visible conversation.
- For `message read` and `message send` through `root_workspace_bash`, default to JSON `stdin`; only use argv JSON when the payload is trivially small.
- If the task already gives the exact room `chatId`, that literal room id is enough to send the acknowledgement or final reply; do not rediscover the same room through `message list`.
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
