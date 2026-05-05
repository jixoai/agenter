## Context

The runtime has converged on an attention-first architecture, but several source systems still bypass the intended law by embedding source-specific interpretation into shared runtime surfaces:

- Message ingress derives social obligations with `shouldTreatSharedMessageAsReplyPending(...)`, writes those judgments into `chatTurnState`, `chatObligationKind`, and `settlesWhen`, and can auto-send visible acknowledgements when the model has not explicitly requested a message mutation.
- Attention bootstrap exposes scheduler state such as `focusState`, `scoreMap`, and `scoreSum` beside model-visible facts in ways that encourage the model to treat runtime organization as semantic truth.
- Terminal lifecycle events such as focus, unfocus, and idle-ready are committed as attention-like work even when they are scheduler signals rather than world facts.
- Runtime skill refresh publishes a constant `ctx-skill-system` attention context and reminder flow, making skill catalog churn compete with user task facts.
- The problem in Skill is the special supply path, not guidance itself: system-owned skills and tool docs should remain free to teach etiquette, defaults, and playbooks, but those soft fields must not be upgraded into hidden runtime conclusions or privileged task peers.
- `followUpAfterMs` is currently message-specific etiquette support, even though the underlying need is a generic delayed watch over objective world-state predicates.

The user has explicitly preserved workspace/root shell privilege as an intentional platform authority. This change does not remove `root_bash`, `workspace_bash`, root-workspace shell world, or workspace-grant law. It only removes source-specific semantic pollution from Message, Terminal, Skill, and prompt/bootstrap paths.

## Goals / Non-Goals

**Goals:**

- Establish a durable four-channel runtime law: `WorldFact`, `CapabilityProjection`, `SchedulerSignal`, and `AgentAction` / `EffectLedger`.
- Make room-visible side effects impossible without an explicit model-authored message action.
- Remove platform-authored chat obligation heuristics and completion labels from attention/model contracts.
- Move room participants, presence, and visible room summaries to queryable room projection surfaces instead of eager message prompt injection.
- Rework attention injection as a current-state kernel law: track AI-visible context snapshots, seed focus-aware `AttentionContext` views, choose per focused context between serialized context and serialized committed attention items by cost instead of by loop-boundary mode, and treat notify as a separately throttled item path.
- This kernel work is not separate scope creep from message cleanup. Message pollution currently leaks through bootstrap/injection law as well as message ingress, so both halves must be cleaned together to avoid a split-brain contract.
- Keep attention focus/score state available for scheduler, UI, debugging, and CLI inspection without treating it as source-authored task semantics.
- Reclassify terminal focus/unfocus/idle-ready as scheduler signals.
- Reclassify skill refresh as capability-index maintenance plus optional ordinary objective attention items, not a permanent user-task peer.
- Preserve system-owned skills and tool guidance as soft fields that can shape behavior without being upgraded into hidden platform judgments, hidden settlement criteria, or privileged special-supply contexts.
- Generalize message follow-up timers into a reusable watch/reminder primitive tied to explicit actions and objective predicates.
- Add regression tests and real runtime walkthroughs proving no hidden side effects or platform-authored obligations remain.

**Non-Goals:**

- Do not remove workspace/root-shell privilege.
- Do not remove Message, Terminal, Skill, or Attention systems.
- Do not remove attention scoring or focus state from runtime internals, UI projections, or debugging surfaces.
- Do not strip room etiquette, terminal recommended strategies, or skill usage playbooks from system-owned guidance; this change removes runtime-authored conclusions and side effects, not soft guidance itself.
- Do not force the model to refetch every fact that is newly committed for the current boundary; new focused facts may still be injected as fact deltas.
- Do not preserve separate injection regimes for "loop recovery" versus "normal tool boundary"; this cleanup should converge on one current-state injection law.
- Do not redesign room ACL, terminal PTY transport, or skill discovery precedence beyond the boundaries needed for this pollution cleanup.
- Do not introduce `any`, `as any`, `@ts-nocheck`, or untyped JSON escape hatches for the migration.

## Decisions

### 1. Runtime systems must classify output before it reaches the kernel

Every adapter output must be classified as one of four channels:

- `WorldFact`: something that happened in a source world and may be reasoned about as task truth.
- `CapabilityProjection`: a derived, queryable view over durable facts.
- `SchedulerSignal`: orchestration data used for wake, ranking, focus, containment, timers, or UI/debugging.
- `AgentAction` / `EffectLedger`: an explicit model/operator action and the durable side effect it produced.

Adapters should not emit ambiguous "attention work" blobs. The kernel can still store attention commits, but the commit must preserve whether it came from a world fact, an explicit action result, or a scheduler-driven reminder.

Alternative considered:
- Continue to normalize everything into generic attention commits.
- Rejected because the current bug is exactly that attention became an untyped river where facts, decisions, scheduling, and side effects are indistinguishable.

Durable-spec alignment note:

- This change must update conflicting long-lived specs before archive rather than relying on archive-time human memory.
- In particular, the bootstrap contract that still names `ctx-skill-system` and the package-level app-server spec lines that still require eager room social envelope or unresolved `terminal_idle_ready` debt must be rewritten to the new law in the same review bundle.

### 2. Message ingress becomes raw room fact ingestion

Message-backed attention should contain only objective room facts:

- `chatId`
- `messageId`
- `senderActorId`
- sender display label as presentation metadata
- raw `content`
- `ref` / reply relation
- explicit mentions if the message protocol supports them
- attachment metadata
- timestamps and source refs

The runtime must delete or stop emitting:

- `shouldTreatSharedMessageAsReplyPending(...)`
- `chatTurnState`
- `chatObligationKind`
- `settlesWhen`
- `room_reply_pending`
- `self_update`
- `required_room_reply_sent`
- `no_external_reply_needed`

Room participants, presence, and visible rooms are real facts, but they are not part of every message fact. They belong to a room snapshot/query projection that the model can request when needed.

The intended replacement is not a brand-new special room API invented by this change. The model should obtain these facts through the existing explicit message/query surfaces:

- room snapshot / page reads from the message control plane
- `message read` for local room context and direct references
- `message query` for authorized history lookup

This cleanup only removes eager prompt stuffing; it does not require a new privileged projection channel.

Alternative considered:
- Keep `chatObligationKind` but rename it to a softer hint.
- Rejected because any platform-authored "your turn" hint is still a hidden social decision.

### 3. Visible room mutation requires an explicit action

The only valid sources of room-visible mutation are explicit message-system actions:

- `message send`
- `message edit`
- `message recall`

The runtime must remove:

- cross-room origin auto-ACK inside `sendMessageTool(...)`
- `originAckFallback`
- `maybeAutoAcknowledgeOriginRoomForToolWork(...)`
- root/tool-work ACK fallback text such as `收到，我先处理一下。`

The model may still decide to acknowledge quickly, but that acknowledgement must be represented as a normal `message send` action and recorded in the effect ledger.

Alternative considered:
- Keep auto-ACK only for long-running `root_bash`.
- Rejected because it still produces an external message without model-authored intent and will keep masking missing action planning.

### 4. Attention runtime kernel injects the cheapest faithful view

The kernel should reason from current AI-visible state, not from a special "loop recovery" branch. It therefore keeps an `attentionContextSnapshot` map representing what the model has already been shown for each context. That snapshot is not raw truth; it is the last successfully injected AI-visible view.

Core law:

- clearing or compacting `ai-messages` also clears `attentionContextSnapshot`
- before the kernel relies on a context in model-visible work, it seeds that context:
  - `focused`: full `AttentionContext`
  - `background`: minimal necessary summary
  - `muted`: no automatic context injection
- only `focused` contexts are eligible for `CommitAttentionItems` injection
- for each focused context, compare:
  - `AttentionContextUserRoleMessageLength * 1.5`
  - `AttentionItemsUserRoleMessageLength`
- inject the cheaper representation for that context
- the final payload may therefore mix `AttentionContext` messages and `AttentionItems` messages from different contexts
- `Notify` attention items are an exception: they still serialize as attention items rather than participating in the cost comparison

For this comparison, `*Length` means the stable length of the final model-visible serialized `user`-role text payload that would actually be injected for that branch, including any routing/debug metadata that is truly part of that injected text. It does not mean raw object size, pre-serialization structure size, or provider-token estimates.

Attention focus and score data remain legitimate scheduler/UI facts. They must not be rendered as source-authored task conclusions.

Any seeded context or attention item payload may expose minimal routing/debug metadata such as:

- context id
- source system id
- aggregate unresolved score
- updated/head refs
- scheduler focus state when needed for routing or UI parity

Those payloads must not expose:

- source-specific obligation labels
- social completion conditions
- source lifecycle judgments phrased as tasks
- full room social context by default
- skill catalog content as a mandatory task context

Alternative considered:
- Keep separate injection code paths for compact/restart recovery versus normal interleaved tool boundaries.
- Rejected because that duplicates heuristics. The safer law is to compare the current AI-visible context state against the current staged attention state every time.

Implementation note:

- a later optimization MAY compare `diff` versus `full` context serialization after the context path already won the cost test
- this optimization is explicitly optional for the first wave, because a misleading diff can create hallucination or operator confusion

### 4.1 Successful injection is a first-class boundary

Because context and item state can continue changing while a request is in flight, the kernel must define one successful-injection boundary. Only after that boundary may it:

- advance `attentionContextSnapshot`
- clear staged keyed attention items that were actually included in the request

Before that boundary, failures or retries keep the prior snapshot and staged items intact.

For this change, the successful-injection boundary is:

- response SSE delivery has started
- and the first returned SSE event is not an error event

This boundary is intentionally later than "request body prepared" and later than "request sent", because the runtime should not claim success before the model has actually begun returning a non-error stream.
After this boundary is crossed, a later stream interruption does not retroactively roll back the snapshot advancement or staged-item clearing decisions made at that boundary.

### 4.2 Commit attention items should stage through a keyed map

Interleaved attention-item staging should behave like a keyed map rather than append-only noise.

- recommitting the same key replaces the staged value
- failed injection keeps the keyed item available
- successful injection clears only the staged keys that were actually committed
- scoped replacement or reset should touch only the addressed namespace or explicitly targeted staged subset, not unrelated producers

This is especially important for producer hooks such as Skill refresh, where repeated retries should not create duplicate prompt noise.

### 4.3 Notify is an item-path exception with quota

`Notify` remains an explicit exception to the commit cost comparison:

- it serializes as an attention-item payload
- it still obeys normal context seeding rules for any accompanying context material
- it is throttled by a configurable quota policy

Default quota contract in this change:

- `muted`: one notify every 12 hours
- `background`: one notify every 0.5 hours

The default contract here only fixes muted/background behavior. Focused-context notify policy may be configured separately and is not constrained by this default.

The runtime must expose query capability for:

- effective quota configuration plus current remaining state
- whether notify can be sent right now for a target
- historical notify-send records used to explain quota decisions

Under the default contract, muted/background eligibility is computed from notify-send records that fall inside each policy's rolling time window.

This cleanup should also explicitly align with the existing acceptance/delivery law already captured in the durable delivery specs. The new kernel wording is not inventing a second acceptance model; it is specializing the same first-non-error-stream-event boundary for snapshot advancement and staged-item clearing.

### 5. Terminal lifecycle signals stay scheduler-only

Terminal facts eligible for model reasoning are:

- explicit command/action results
- snapshots
- diffs
- bounded await evidence
- durable process state changes when they are objective terminal facts

Terminal signals that should move to scheduler-only handling:

- `terminal_focus`
- `terminal_unfocus`
- `terminal_idle_ready`

Idle-ready may wake or rank a loop, but it must not be phrased as "Terminal X is ready for your input" inside task attention. If model reasoning needs terminal detail, it can read the terminal projection or receive a new snapshot/diff fact.

Alternative considered:
- Keep `terminal_idle_ready` as high-score attention.
- Rejected because it says "you should act" rather than "terminal state changed".

### 6. Skill refresh maintains an index; guidance remains a soft field

The skill system remains the durable owner of runtime-visible skill truth. The change is how that truth enters model work:

- skill list/search/info/config stay queryable capabilities
- live refresh updates the skill index and baseline fingerprints
- changed skills may publish ordinary objective attention items naming changed skill, root kind, and changed files
- a skill refresh must not synthesize or select a dedicated skill-system attention context solely because files changed
- skill body text is fetched on demand, or brought in through an explicit query, explicit mount, or already-objective task dependency
- built-in skills and tool docs may continue to teach etiquette, defaults, and recommended playbooks as non-binding guidance; the cleanup only removes hidden runtime-authored obligations and hidden side effects

Alternative considered:
- Remove all system-specific skill guidance so the model reasons only from raw facts.
- Rejected because guidance is a valid soft field. The problem is hidden runtime decisions and privileged supply paths, not guidance itself.

### 7. Follow-up becomes a generic watch primitive

Message `followUpAfterMs` should be migrated to a generic one-shot watch/reminder primitive:

- A watch is created by an explicit action.
- A watch has a due time.
- A watch has an objective predicate over world facts or projections.
- At due time, the runtime checks the predicate.
- If the predicate still holds, the runtime emits a new reminder fact/signal for the model to re-decide.
- The runtime never sends a room message or mutates external state because a watch expires.

The first migration can preserve `followUpAfterMs` as a deprecated message-tool alias if needed, but its implementation must delegate to the generic watch primitive and its descriptor must stop describing message etiquette.

Alternative considered:
- Keep `followUpAfterMs` message-specific because only chat currently uses it.
- Rejected because the same law is needed for terminal waits, skill sync review, external task checks, and future systems.

### 8. Tests must assert absence of hidden behavior, not only positive flows

This change must add negative regression tests:

- no platform-generated room message without explicit message action
- no reply obligation labels for question marks, direct rooms, or `auth:*` group senders
- no auto-ACK before root/tool work
- no terminal lifecycle task attention for focus/unfocus/idle-ready
- no skill refresh task context unless explicitly mounted/fetched/notified by the new law
- no `followUpAfterMs` message-only reminder path outside the generic watch primitive

BDD naming remains required: `describe("Feature: ...")` and `test("Scenario: Given ... When ... Then ...")`.

## Risks / Trade-offs

- [Risk] Existing real-AI behavior may become quieter because auto-ACK disappears. → Mitigation: update skill guidance to teach explicit acknowledgement actions and add walkthroughs proving the model can still acknowledge when it chooses.
- [Risk] Removing eager room social context may force extra room snapshot queries. → Mitigation: provide a small, typed room projection command and allow current-boundary message fact deltas to remain directly visible.
- [Risk] Bootstrap cleanup may break tests that assert exact prompt text. → Mitigation: rewrite tests around durable contracts and observable behavior, not prompt string snapshots except where prompt shape is the contract.
- [Risk] A diff-based context optimization could create hallucinated omissions or confusing patch-style prompts. → Mitigation: keep diff optional and out of first-wave acceptance unless evidence shows it is safe.
- [Risk] Notify quota may feel arbitrary if the runtime cannot explain current allowance. → Mitigation: make quota queryable, return effective config plus remaining state, and expose historical notify records used for the decision.
- [Risk] Successful-injection accounting can become inconsistent if later stream interruption is treated as a rollback. → Mitigation: define the boundary once at first non-error SSE, then never retroactively undo that crossed boundary.
- [Risk] The cleanup may archive with local correctness but durable-spec contradiction if old bootstrap/package specs still mention `ctx-skill-system`, eager room social envelope, or unresolved terminal-idle debt. → Mitigation: make those spec rewrites explicit deliverables instead of generic “update docs later”.
- [Risk] Skill refresh changes may hide important skill updates. → Mitigation: preserve explicit skill index inspection and objective change notifications, but remove default task equivalence.
- [Risk] Generic watches can become another hidden obligation system. → Mitigation: require action ownership, objective predicates, no auto-effect, and visible effect-ledger/watch inspection.

## Migration Plan

1. Add the new boundary-law types and tests first so later code has a target vocabulary.
2. Remove message auto-ACK side effects before changing prompt shape, because hidden external mutation is the highest-risk bug.
3. Replace message obligation metadata with raw room fact envelopes and move room social context to queryable projection.
4. Rework the attention runtime kernel so `attentionContextSnapshot`, focus-aware seeding, commit-item cost comparison, notify exception handling, and keyed staged-item semantics all use one current-state injection law.
5. Clean `agenter-ai` and prompt/bootstrap serialization so removed obligation fields cannot reappear from compact/history paths.
6. Reclassify terminal lifecycle events as scheduler signals and keep snapshots/diffs/action results as facts.
7. Rework skill adapter/bootstrap so skill refresh updates the capability index and only enters task work through ordinary objective attention items, explicit query, explicit mount, or already-objective task dependency.
8. Add generic watch primitive and migrate/deprecate `followUpAfterMs`.
9. Regenerate runtime skill catalog from corrected skill source text.
10. Update durable docs and run the verification matrix.

Rollback strategy:

- Revert by feature branch before archive if tests show real runtime cannot recover explicit acknowledgement behavior.
- Do not keep a hybrid rollback that restores auto-ACK while removing metadata; that would preserve the worst violation.

## Open Questions

- Whether the first implementation should keep `followUpAfterMs` as a backwards-compatible alias or remove it from the public message descriptor immediately.
- Whether scheduler metadata in model bootstrap should include `focusState` by default or only in debug/inspection contexts.
- Whether skill change publication should always emit ordinary objective attention items or additionally support explicit opt-out without reintroducing a dedicated skill context.
- Whether the generic watch primitive should persist in the existing attention tables or a new watch/effect ledger table.
