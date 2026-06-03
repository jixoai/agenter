## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` records the final decisions: `primaryRoomId` must be removed in one cut, room sends must require explicit room targeting unless a message-origin source already identifies the room, there is no protected-room concept, and session state is understood through `attentionContext -> source`.
- [x] 1.2 Confirm the code survey covers every current `primaryRoomId` and top-level `chat.*` dependency across session persistence, runtime bootstrap, notification/unread recovery, room lifecycle actions, public control-plane routers, and real-AI harness/test helpers.
- [ ] 1.3 Confirm no apply work starts before the OpenSpec artifact commit for `retire-legacy-chat-surface` is clean and separate from product-code edits.
- [x] 1.4 Confirm task checkboxes in this file will only be updated by the agent that completed and verified the matching work in the current working context.

## 2. BDD Contract

- [x] 2.1 Add session-model tests: Given a session is created, started, stopped, and restarted When durable session metadata and runtime bootstrap state are inspected Then no `primaryRoomId` or equivalent default-room field exists anywhere in the session model.
- [x] 2.2 Add command-surface tests: Given an operator send omits a room target When message send is attempted Then the command fails with a direct missing-room error and no room is synthesized from session state.
- [x] 2.3 Add explicit-room error tests: Given a caller specifies an archived room, unknown room, deleted room, or room without grant When a room send/mutation is attempted Then the error reflects that explicit room state and never falls back to another room.
- [x] 2.4 Add source-routing tests: Given a cycle originates from a message-system source When the runtime emits a visible follow-up reply Then the reply routes to that origin room; and Given a cycle originates only from non-message sources When no explicit room target is supplied Then visible room send fails with a missing-room error.
- [x] 2.5 Add room-lifecycle tests: Given an ordinary room is otherwise eligible for archive/delete When lifecycle mutation is requested Then no hidden protected-room/default-room rule blocks the action.
- [x] 2.6 Add stopped-session recovery tests: Given persisted attention contexts and source refs exist for message-system events When unread/notification state is rebuilt after stop or cold restart Then recovery derives buckets and items from `attentionContext -> source` facts rather than from a session default room id.
- [x] 2.7 Add public-surface tests: Given the control plane is inspected When room transcript and runtime cycle/heartbeat surfaces are listed Then top-level `chat.*` truth-facing endpoints are absent and cycle inspection remains available only as a projection-oriented surface.
- [x] 2.8 Add real-AI / harness regression scenarios: Given real loopbus, room-terminal, note-system, and message-query scenarios need a visible reply target When they run after this change Then they provide explicit room targeting or rely on explicit message-origin source routing instead of `primaryRoomId`.

## 3. Implementation

- [ ] 3.1 Run `bun run openspec:vision -- commit-check retire-legacy-chat-surface --phase apply` and commit the ready OpenSpec artifacts before starting app-code work.
- [x] 3.2 Remove `primaryRoomId` from the durable session model in one cut: session document types, session store writes, session catalog metadata, runtime bootstrap options, and any persisted session JSON/schema expectations.
- [x] 3.3 Remove runtime default-room fallbacks: delete `getDefaultChatId()` / equivalent default-room routing assumptions and require explicit room targeting or explicit message-source routing everywhere visible room sends can occur.
- [x] 3.4 Replace legacy room routing with attention/source routing: make reply routing, visibility routing, and source-to-room resolution derive from explicit `attentionContext` / source facts instead of session-owned default-room fields.
- [x] 3.5 Remove hidden protected-room behavior and any archive/delete rule that exists only because a room used to be treated as default/built-in.
- [x] 3.6 Retire top-level `chat.*` truth-facing control-plane surfaces and migrate transcript reads/writes plus cycle/heartbeat inspection onto non-`chat` namespaces that preserve transcript-vs-projection separation.
- [x] 3.7 Update stopped-session notification/unread recovery, background attention buckets, and cold-restart repair paths so they rebuild from persisted attention/source facts without `primaryRoomId`.
- [x] 3.8 Update real harnesses, fixtures, helper scripts, and BDD scenarios to use explicit room ids or explicit message-origin source routing instead of `primaryRoomId`.
- [x] 3.9 Add concise intent comments at the critical cut points: legacy session-field removal, explicit missing-room errors, attention/source-based routing, and removal of protected-room logic.
- [x] 3.10 Update only current-context completed task checkboxes and commit them with the matching implementation / BDD evidence.

## 4. Verification

- [x] 4.1 Run targeted app-server tests covering session persistence, room command errors, source-based reply routing, room lifecycle mutations, stopped-session notifications, and public control-plane surface changes.
- [x] 4.2 Run targeted real or harness-backed regressions covering room-terminal, loopbus follow-up, note-system, and message-query flows after the `primaryRoomId` removal.
- [x] 4.3 Run `bun run --filter '@agenter/app-server' typecheck`.
- [x] 4.4 Run `bun run openspec:vision -- validate retire-legacy-chat-surface`.
- [x] 4.5 Run `bun run openspec:vision -- commit-check retire-legacy-chat-surface --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing the implementation against `plans/plan.md`, both delta specs, and the “one-cut removal of `primaryRoomId` plus all side effects” decision.
- [x] 5.2 Generate `review/self-review.html` as the structured evidence presentation for explicit room errors, source-based routing, notification recovery, and public-surface cleanup.
- [ ] 5.3 If self-review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If self-review enters a real loop, run `bun run openspec:vision -- review-state retire-legacy-chat-surface` to persist iteration state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff retire-legacy-chat-surface` and commit the handoff evidence before returning to user discussion.
- [x] 5.6 If review exits normally, run `openspec archive retire-legacy-chat-surface` and commit the archive result.
- [x] 5.7 Run `bun run openspec:vision -- check retire-legacy-chat-surface` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
