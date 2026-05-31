## Context

The current message skill already teaches three important laws:

- send a short acknowledgement before disappearing into longer work
- do not spam the room with every internal retry
- treat chat-related attention as a real conversation obligation

What is missing is a first-class way for a sent room message to say: "if this is still the latest visible room fact after N milliseconds, remind me to decide whether the room now needs another reply."

That gap matters because the underlying need is not a transport timeout. It is etiquette-driven follow-up under uncertainty:

- a user may never answer a clarification question
- a tool call may keep failing and the room may deserve a progress update
- a slow success may make a premature progress message unnecessary

The user requirement is intentionally narrow:

- one-shot only
- bound to the just-sent message
- no global config, no default 5-minute policy
- no automatic visible room message
- future durable scheduling belongs in `TaskSystem`, not permanently inside `MessageSystem`

There is one additional architectural constraint already present in spec truth: durable room messages must not encode AI scheduling or cycle-queue state. That means the new reminder cannot be stored as visible message metadata or transported as shared room truth.

## Goals / Non-Goals

**Goals:**

- Add a sender-controlled, one-shot `followUpAfterMs` surface to runtime-local `message send`.
- Bind reminder eligibility to the exact sent `messageId`.
- Keep reminder state out of durable room messages, snapshots, and transport payloads.
- Fire one committed attention item only when the anchored message is still the latest visible room message at due time.
- Preserve the current rule that any later visible room reply still requires an explicit message mutation.
- Leave a clean migration path so future `TaskSystem` scheduling can replace the temporary timer bridge without changing the external contract.

**Non-Goals:**

- Add recurring reminders, snooze chains, or global reminder defaults.
- Auto-send progress pings, nudges, or follow-up questions when the timer expires.
- Solve durable cross-restart scheduling in this change.
- Redesign compact positional `message send` encoding to carry reminder metadata.
- Extend `message edit` or `message recall` with new reminder controls in this change.

## Decisions

### 1. The external field will be `followUpAfterMs`

The runtime-local `message send` object JSON payload will use `followUpAfterMs`.

Why:

- `replyTimeout` sounds like a transport timeout or a deadline after which the system replies automatically.
- `nextTimeout` is too vague about what is timing out.
- `followUpAfterMs` makes the intent explicit: after this delay, revisit whether follow-up is needed.

Rejected alternatives:

- `replyTimeout` or `replyTimeoutMs`: too easy to misread as auto-reply or request-timeout semantics.
- nested config objects: unnecessary complexity for a deliberately narrow 80% feature.

### 2. Reminder state will live in a runtime-private sidecar, not in `MessageRecord`

The reminder is not durable shared room truth. It is a sender-private runtime obligation derived from a successful room send. The implementation should persist it in runtime-private reminder state keyed by:

- `chatId`
- `anchorMessageId`
- sender/runtime identity
- `dueAt`
- lifecycle state such as `pending | fired | suppressed`

Why:

- existing message-system law already says durable room messages must not encode AI scheduling state
- other room readers must not see the sender's private reminder timer
- future `TaskSystem` migration becomes straightforward if the reminder already exists as a sidecar obligation instead of visible room metadata

Rejected alternative:

- storing reminder fields on `MessageRecord.metadata`. That would leak AI scheduling residue into durable room truth and violate existing room-law boundaries.

### 3. Eligibility is anchored to "still the latest visible room message"

The reminder is only meaningful while the anchored sent message still represents the latest visible room state. If any later visible room message appears before the due time, the older reminder becomes stale and must not create new debt later.

This applies equally when:

- the user answers
- another participant speaks
- the assistant already sent a newer visible progress update

Why:

- the feature is about revisiting silence after one particular room message
- later room activity already created fresher facts and usually fresher attention
- this guard removes most accidental "late stale nudge" behavior without adding a general policy engine

Rejected alternative:

- always fire the reminder even if newer room activity exists. That would create duplicate or contradictory attention for stale silence.

### 4. Expiry commits attention only; it never sends a room message

When an eligible reminder reaches due time, the runtime commits one typed attention item bound to the same room context and anchor message. That item tells the AI to decide what to do next. It does not append a visible room message.

Why:

- the correct follow-up is contextual and cannot be hard-coded
- etiquette is a judgment call, not an automatic chat robot policy
- attention is the platform-native place for unresolved obligation

Rejected alternatives:

- auto-send a canned "still working on it" message. That would blur role boundaries and generate spam.
- hidden source-specific callbacks that bypass attention. That would reintroduce special-case workflow branches into the runtime core.

### 5. Object JSON is the required surface; compact mode stays unchanged for now

`followUpAfterMs` will be supported on the standard object JSON payload for `message send`, especially the preferred `root_bash.command=message send` plus JSON `stdin` flow. Compact positional mode does not gain a new positional slot in this change.

Why:

- the reminder is control metadata, not just another short positional content token
- object JSON keeps the meaning explicit and avoids brittle positional expansion
- this keeps the change small and avoids needless compact-mode churn

Rejected alternative:

- inventing a new compact tuple slot immediately. That increases rollout risk for a feature whose intended path is already JSON-first.

### 6. The first implementation may use a lightweight runtime timer bridge, but the contract stays scheduler-agnostic

The change should be implemented behind a small runtime-owned timing bridge now. Later, when `TaskSystem` grows durable timed-task publication, the same external `followUpAfterMs` contract should map onto a task-backed scheduler instead.

Why:

- the app need exists now
- the long-term scheduler law belongs elsewhere
- separating contract from implementation avoids another future rename or behavior break

## Risks / Trade-offs

- [Risk] Session restart can lose pending reminders before `TaskSystem` owns durable timing. → Mitigation: document this as an intentional interim limitation and keep the external contract migration-ready.
- [Risk] Ambiguous reminder naming could make implementers treat it as auto-reply timeout logic. → Mitigation: use `followUpAfterMs` and repeat "attention only, no auto-send" in help, specs, and skill guidance.
- [Risk] If stale reminders are not suppressed, the runtime will create duplicate debt after the room already moved on. → Mitigation: gate firing on the anchor message still being the latest visible room message.
- [Risk] Extending compact positional mode now would enlarge the blast radius of a narrow feature. → Mitigation: keep reminder support on object JSON only in this change.

## Migration Plan

1. Extend the runtime-local `message send` schema/help/guidance with `followUpAfterMs`.
2. Add runtime-private reminder sidecar state keyed by sent message and due time.
3. Arm reminders on successful send, suppress them when the anchor is no longer the latest visible room message, and commit attention on eligible expiry.
4. Keep the timer bridge isolated so a later `TaskSystem` implementation can replace only the timing backend.

## Open Questions

- None for this proposal. Maximum allowed duration and persistence strategy can stay implementation-local as long as the one-shot, message-bound, attention-only contract holds.
