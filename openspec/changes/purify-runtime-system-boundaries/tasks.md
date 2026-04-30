## 1. Platform Boundary Law

- [x] 1.1 Add typed runtime boundary primitives for `WorldFact`, `CapabilityProjection`, `SchedulerSignal`, `AgentAction`, and `EffectLedger` without using `any`, `as any`, or `@ts-nocheck`
- [x] 1.2 Add adapter-facing helpers that require every runtime-system emission to declare its boundary channel before reaching the kernel host
- [ ] 1.3 Add development/test assertions or guards that reject ambiguous adapter emissions in Message, Terminal, Skill, and future-system paths
- [x] 1.4 Add durable effect-ledger records that can trace explicit actions to durable external effects such as room messages, including stable action/effect identity, actor identity, target identity, timestamp, and cycle/model-call refs when available
- [ ] 1.5 Ensure workspace/root shell privilege remains intact and is documented as outside this cleanup scope

## 2. Message Ingress And Side Effects

- [x] 2.1 Remove `shouldTreatSharedMessageAsReplyPending(...)` and all call sites from `packages/app-server/src/session-runtime.ts`
- [x] 2.2 Stop emitting `chatTurnState`, `chatObligationKind`, `settlesWhen`, `room_reply_pending`, `self_update`, `required_room_reply_sent`, and `no_external_reply_needed` from message-backed attention and model envelopes
- [x] 2.3 Reduce message ingress/model facts to objective fields such as `chatId`, `messageId`, `senderActorId`, sender label, raw content, `ref`, explicit mentions, attachments, timestamps, and source refs
- [x] 2.4 Move participants, presence, focused seats, and visible-room summaries out of eager message envelopes into explicit room/message projection query surfaces
- [x] 2.5 Remove cross-room origin auto-ACK behavior from `sendMessageTool(...)`, including `originAckFallback`
- [x] 2.6 Remove `maybeAutoAcknowledgeOriginRoomForToolWork(...)` and its `root_bash` / tool-work call sites
- [x] 2.7 Ensure room-visible transcript mutation occurs only through explicit `message send`, `message edit`, or `message recall` actions
- [x] 2.8 Update runtime tool views and message send results so explicit message actions remain easy for the model to inspect without hidden fallback messages

## 3. Attention Runtime Kernel And Prompt Cleanup

- [x] 3.1 Add `attentionContextSnapshot` tracking for AI-visible context views and clear it whenever `ai-messages` are cleared or compacted away
- [x] 3.2 Update attention bootstrap/context serialization so scheduler metadata stays separate from model-visible source facts
- [x] 3.3 Remove removed chat obligation fields from `packages/app-server/src/agenter-ai.ts`, compact/history enrichment, active attention prompt-window messages, and any replay path
- [ ] 3.4 Keep focus and score data available only as scheduler/debug/routing metadata, not as source-authored task instructions or settlement conditions
- [x] 3.5 Seed `AttentionContext` into `ai-messages` by focus state: focused full, background minimal summary, muted none
- [x] 3.6 Restrict `CommitAttentionItems` injection to focused contexts only
- [x] 3.7 Implement per-focused-context injection selection by comparing `AttentionContextUserRoleMessageLength * 1.5` against `AttentionItemsUserRoleMessageLength`
- [x] 3.8 Allow final model input to mix `AttentionContext` messages and `AttentionItems` messages from different contexts based on those per-context decisions
- [x] 3.9 Treat `Notify` attention items as serialized attention-item exceptions that bypass the commit cost comparison while still obeying normal context-seeding law
- [x] 3.10 Define the successful-injection boundary as "response SSE has started and the first returned SSE event is non-error" for advancing `attentionContextSnapshot` and clearing staged items that were actually injected, and do not retroactively roll back after later stream interruption
- [x] 3.11 Add keyed staged attention-item map semantics for interleaved injection, including keyed upsert, scoped replacement, scoped reset, removal, and retry-safe retention until successful injection
- [ ] 3.12 Add an explicit way for the model to fetch full context details through CLI/API instead of relying on bootstrap-inlined social or skill projections
- [ ] 3.13 Defer or guard any diff-vs-full context optimization so first-wave acceptance does not depend on patch-style context injection
- [x] 3.14 Add configurable notify quota enforcement with default period quotas for `muted` and `background`
- [x] 3.15 Add notify quota query capability that returns effective quota configuration, current remaining state, send-eligibility, and historical notify-send records
- [ ] 3.16 Rewrite conflicting long-lived bootstrap/delivery specs so this change does not archive with `ctx-skill-system` bootstrap or duplicate acceptance-law wording

## 4. Terminal Adapter Cleanup

- [x] 4.1 Reclassify `terminal_focus` as a scheduler signal or UI invalidation instead of model-visible attention task content
- [x] 4.2 Reclassify `terminal_unfocus` as a scheduler signal or UI invalidation instead of model-visible attention task content
- [x] 4.3 Reclassify `terminal_idle_ready` as a scheduler signal that can wake/rank work without injecting `ready for your input` task text
- [x] 4.4 Preserve terminal snapshots, diffs, await evidence, process facts, and explicit command results as objective model-visible terminal facts
- [x] 4.5 Update terminal adapter tests and fixtures so lifecycle coordination and terminal observations use different channels

## 5. Skill System And Built-In Catalog

- [x] 5.1 Change runtime skill refresh so it maintains a queryable skill index by default without creating/selecting `ctx-skill-system` or any dedicated skill-only task context
- [x] 5.2 Keep `skill list`, `skill search`, `skill info`, and `skill get-config` as explicit projection/query surfaces that enter the decision surface through tool results
- [x] 5.3 Define and implement the policy for when skill changes publish ordinary objective attention items, including changed skill name, root kind, and changed files, without synthesizing a dedicated skill context and using the keyed interleaved attention-item staging path
- [x] 5.4 Ensure irrelevant skill watcher dirtiness does not preempt active room or terminal work by default
- [x] 5.5 Update package-owned built-in skill source files to remove platform-authored social obligation language and auto-ACK guidance while preserving optional etiquette and recommended playbooks as non-binding guidance
- [x] 5.6 Regenerate `packages/app-server/src/generated/runtime-skill-catalog.generated.ts` from the corrected skill sources
- [x] 5.7 Add catalog tests that fail if removed pollution terms reappear in generated built-in skill bodies

## 6. Generic Watch Primitive

- [x] 6.1 Add a generic one-shot watch/reminder model owned by an explicit action and backed by an objective due time plus predicate
- [x] 6.2 Implement watch due-time evaluation against world facts or capability projections
- [x] 6.3 Ensure due watches create only reminder facts/signals and never perform external side effects automatically
- [x] 6.4 Migrate message `followUpAfterMs` to delegate to the generic watch primitive or remove it from the public descriptor if backwards compatibility is intentionally broken
- [x] 6.5 Update `runtime-tool-descriptors.ts` so follow-up wording no longer describes message-specific etiquette and clearly states that expiry only asks the model to re-decide
- [x] 6.6 Add inspection/publication support so active, satisfied, and expired watches are observable in runtime diagnostics

## 7. Backend Tests

- [x] 7.1 Add BDD tests proving question marks do not create platform reply obligations
- [x] 7.2 Add BDD tests proving direct-room messages do not create platform reply obligations
- [x] 7.3 Add BDD tests proving `auth:*` group senders do not create platform reply obligations
- [x] 7.4 Add BDD tests proving `root_bash` and non-message tool work do not auto-send origin-room acknowledgements
- [x] 7.5 Add BDD tests proving cross-room relay sends only the explicit target-room message and no origin fallback message
- [x] 7.6 Add BDD tests proving attention commits alone do not create room transcript rows
- [x] 7.7 Add BDD tests proving message participants, presence, and visible rooms are queryable projections rather than eager message-envelope fields
- [x] 7.8 Add BDD tests proving attention bootstrap/context seeding omits removed chat obligation labels and keeps scheduler metadata separate
- [x] 7.9 Add BDD tests proving focused contexts seed full views, background contexts seed minimal views, and muted contexts do not auto-seed
- [x] 7.10 Add BDD tests proving only focused contexts can serialize `CommitAttentionItems`
- [x] 7.11 Add BDD tests proving per-context cost comparison can choose items for one context and context for another in the same model input
- [x] 7.12 Add BDD tests proving `Notify` attention items always serialize as item payloads while still obeying the normal focus-aware seeding law for any accompanying context material
- [x] 7.13 Add BDD tests proving muted notify is throttled to one send per 12 hours by default and background notify is throttled to one send per 0.5 hours by default
- [x] 7.14 Add BDD tests proving notify quota queries can return effective config, current remaining state, send-eligibility, and historical notify records, with muted/background defaults computed from rolling time windows
- [x] 7.15 Add BDD tests proving failed requests do not advance `attentionContextSnapshot` or clear staged keyed attention items
- [x] 7.16 Add BDD tests proving successful requests advance injected snapshots only after response SSE starts with a non-error first event, clear only the staged keys actually committed by that request, and do not retroactively roll back after later stream interruption
- [x] 7.17 Add BDD tests proving terminal focus/unfocus/idle-ready are scheduler signals and not task facts
- [x] 7.18 Add BDD tests proving skill refresh updates the skill index and, when published, emits only ordinary objective attention items without creating a dedicated skill task context by default
- [x] 7.19 Add BDD tests proving generic watches re-evaluate predicates, emit reminders when still relevant, stay silent when satisfied, and never auto-send messages
- [x] 7.20 Add effect-ledger tests proving explicit message actions are causally linked to resulting room rows
- [x] 7.21 Add BDD tests proving the cost comparison uses final serialized user-role text length rather than raw object size or provider-token estimates

## 8. Frontend And Runtime Inspection Tests

- [ ] 8.1 Update any WebUI/runtime inspection surfaces that displayed removed obligation labels so they render objective facts, scheduler metadata, and explicit effects instead
- [ ] 8.2 Add or update Storybook DOM or unit contracts for any changed WebUI surfaces if removed labels were user-visible
- [ ] 8.3 Add client/runtime publication tests proving scheduler signals, world facts, projections, and explicit effects are distinguishable in consumed payloads
- [ ] 8.4 Verify mobile and desktop runtime inspection surfaces still expose enough evidence for room facts, terminal facts, skill index state, and watches if UI changed

## 9. Documentation And Durable Specs

- [ ] 9.1 Update `packages/app-server/SPEC.md` with the durable four-channel runtime law, explicit-effect rule, no eager room social envelope, and no unresolved `terminal_idle_ready` debt wording
- [ ] 9.2 Update `openspec/specs/attention-bootstrap-protocol/spec.md` so bootstrap no longer requires `ctx-skill-system` by default and instead follows the new skill/bootstrap law
- [ ] 9.3 Update affected long-lived delivery/provider lifecycle specs or cross-references so successful-injection bookkeeping clearly reuses the existing first-valid-stream-event acceptance law
- [ ] 9.4 Update affected long-lived specs or comments so Message, Terminal, Skill, Attention, and Watch boundaries match this change
- [ ] 9.5 Update runtime skill source documentation and references so generated catalog text teaches explicit action/query/watch behavior
- [ ] 9.6 Update any developer-facing docs that still describe auto-ACK, `room_reply_pending`, `self_update`, or message-specific follow-up etiquette
- [ ] 9.7 Add a short migration note explaining removed fields and the supported replacement paths for model guidance, UI inspection, and tests

## 10. Real Runtime Walkthrough

- [ ] 10.1 Run a real or integration room-message flow where another actor sends a question and verify the runtime records facts without auto-replying
- [ ] 10.2 Run a real or integration `root_bash` flow from a room-originated task and verify no fallback acknowledgement appears before explicit `message send`
- [ ] 10.3 Run a cross-room relay flow and verify only explicit target/origin messages appear in transcripts
- [ ] 10.4 Run a kernel injection flow where one focused context chooses serialized items, another chooses serialized context, and the final prompt mixes both without hidden obligations
- [ ] 10.5 Run a failed AI-call retry flow and verify `attentionContextSnapshot` plus staged keyed attention items do not falsely advance on failure
- [ ] 10.6 Run response-stream boundary cases and verify that an error-first SSE does not advance `attentionContextSnapshot` or clear staged items, while a later post-boundary stream interruption does not retroactively roll them back
- [ ] 10.7 Run a notify quota flow and verify muted/background defaults, remaining-quota queries, send-eligibility queries, and historical notify record queries
- [ ] 10.8 Run a terminal idle/focus flow and verify the model sees objective terminal observations, not lifecycle obligation text
- [ ] 10.9 Run a skill source edit/refresh flow and verify the index changes are queryable and, if published, arrive as ordinary objective attention items without becoming default user-task work or a dedicated skill context
- [ ] 10.10 Run a watch/follow-up flow and verify due reminders re-open model decision without any automatic room mutation
- [ ] 10.11 Write walkthrough evidence into `openspec/changes/purify-runtime-system-boundaries/walkthroughs/*.md`, with each file recording commands, expected result, actual result, and log/DB evidence paths or queries

## 11. Verification Commands

- [x] 11.1 Run targeted app-server tests for message ingress, attention bootstrap, terminal adapter, skill system, catalog generation, effect ledger, and watches
- [x] 11.2 Run `bun run typecheck`
- [ ] 11.3 Run `bun run test`
- [x] 11.4 Run any package-specific test commands needed by changed packages, including WebUI unit/DOM tests if frontend surfaces changed
- [ ] 11.5 Run a repository search proving removed pollution terms do not remain in runtime prompt/catalog contracts except in archived specs, tests asserting absence, or migration notes
- [ ] 11.6 Run `openspec validate purify-runtime-system-boundaries --strict` or the repository's equivalent OpenSpec validation command

## 12. Acceptance Gate

- [ ] 12.1 No room-visible message can be produced without an explicit message action in tests or walkthrough evidence
- [ ] 12.2 No platform-authored chat obligation field remains in active runtime prompt/bootstrap/model-envelope contracts
- [ ] 12.3 Scheduler signals remain useful for wake/ranking/UI but are not serialized as source-specific task semantics
- [ ] 12.4 `attentionContextSnapshot`, focus-aware seeding, cost-based commit-item injection, notify exception handling, notify quota, and keyed staged-item semantics all follow one current-state kernel law rather than separate recovery branches
- [ ] 12.5 Message, Terminal, Skill, and Watch integrations all use the shared boundary vocabulary instead of source-specific kernel branches, and skill changes do not create hidden dedicated contexts by default
- [ ] 12.6 Workspace/root shell privilege still works and remains explicitly out of scope for pollution cleanup
- [ ] 12.7 All updated docs, specs, generated catalogs, tests, and walkthrough evidence are committed or ready for review together
