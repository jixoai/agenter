# Room protocols

Use `message` when the room itself is part of the durable workflow.

Good defaults:

- read before replying when facts may have changed
- send one acknowledgement if the work will take time
- if the work needs multiple steps, send that acknowledgement before you start the deeper work
- keep acknowledgements short; they should claim ownership, not replay the whole spec
- keep room-facing language scoped to what the room needs
- if `visibleRooms` already includes a room whose title or participants match the requested person, use that room as the relay channel instead of claiming the person is unavailable
- a participant missing from the current room does not mean they are unreachable elsewhere in the runtime
- if you relay out, the origin room still owns the final user-visible answer; a relay acknowledgement is not completion
- while the relay target has not answered yet, keep the origin obligation open instead of settling it
- once the relay target answers, return that answer to the origin room before you settle the attention
- once the evidence is ready and the room is waiting for a protocol reply, send that durable message immediately
- if the current obligation is `self_update` / `no_external_reply_needed`, prefer private tool work or attention settlement over another room reply
- if the room fixed a concrete URL, path, or token, send that exact value back instead of a normalized variant such as a sibling path
- if you need to correct yourself, send a new durable replacement instead of treating the earlier message as final truth
- after the protocol reply is sent, switch back to `attention` and settle the same obligation instead of repeatedly re-reading the room

Protocol discipline:

- use the exact requested prefix
- do not invent extra envelope fields
- do not answer a contract owned by someone else
- do not widen the audience: only send to the room that actually owns that reply

Correction pattern:

- if a room message was invalid, replace it with a new durable message
- do not treat the invalid message as the final truth
