## 1. Spec and contract alignment

- [x] 1.1 Add OpenSpec delta specs for attention payload/body/egress separation and LoopBus scheduler-only metadata.
- [x] 1.2 Identify and remove durable spec statements that still describe open attention metadata or metadata-based routing intent.

## 2. Attention core type cleanup

- [x] 2.1 Restrict `AttentionCommitMeta` to provenance fields and add typed attention egress descriptors to the durable attention model.
- [x] 2.2 Update attention store, snapshots, and query/tool projections to persist and expose the new typed egress contract without raw metadata bags.

## 3. Runtime ingestion and prompt assembly refactor

- [x] 3.1 Replace open draft metadata usage in `SessionRuntime` with typed draft presentation/provenance/semantic fields.
- [x] 3.2 Refactor attention bootstrap and delta item serialization so AI-visible payloads emit explicit provenance/body/egress fields instead of raw `meta`.
- [x] 3.3 Keep LoopBus message metadata limited to scheduler/protocol facts and remove AI-relevant payload leakage from transport metadata.

## 4. Adapter and egress integration

- [x] 4.1 Update message egress routing to consume typed attention egress descriptors rather than `commit.meta.replyTarget`.
- [x] 4.2 Verify message, terminal, and task source adapters still produce enough AI-visible body detail after metadata cleanup.

## 5. Verification and follow-up notes

- [x] 5.1 Update unit/integration tests across `packages/attention-system` and `packages/app-server` for typed egress, richer body payloads, and scheduler-only metadata.
- [x] 5.2 Run focused typecheck/tests plus the relevant backend harness scripts.
- [x] 5.3 Add/update `.chat` frontend integration notes describing the new attention payload contract and reactive caveats for future WebUI work.
