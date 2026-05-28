## Context

`AttentionSystem` already owns its data model and snapshot format, but its operational write path is still half-owned by `SessionRuntime`. External systems can describe work, yet the final durable commit often still happens through runtime-private methods like `commitRuntimeSystemIngress(...)` and `handleCommittedAttentionCommit(...)`. That means attention truth is not fully separable from runtime lifecycle.

The user direction is stricter:

- attention is a pure information system around `AttentionItem` and `AttentionContext`
- external systems own their own timers, receipts, watches, and side-effect behavior
- those systems should be able to commit attention truth directly
- session runtime should cold-start from attention durability and continue work, not act as the mandatory writer

This change therefore is not a local follow-up bugfix. It is a boundary correction that makes `AttentionSystem` independently developable and maintainable.

## Goals / Non-Goals

**Goals:**

- establish an independent attention ingress control plane outside `SessionRuntime`
- make durable attention commits possible while a session runtime is offline
- preserve one unified attention law for context mutation, score projection, focus state, and history
- reduce `SessionRuntime` to attention recovery, scheduling, orchestration, and explicit effect production
- drive the implementation through BDD at package and integration boundaries
- build explicit multi-round review gates into the task plan so implementation can be realigned against the original law before drift accumulates

**Non-Goals:**

- do not reintroduce delivery-ledger, watch, receipt, or queue semantics as intrinsic attention concepts
- do not solve remote ownership propagation through ad-hoc transport fields; that remains future `AsyncContext + RPC` architecture work
- do not redesign workspace-mounted systems in this change; only make this change compatible with that future work
- do not force a one-shot big bang migration with no compatibility bridge for existing runtime consumers

## Decisions

### Decision 1: Introduce an attention-owned control plane

Create an attention-owned ingress/persistence surface inside `packages/attention-system` or an adjacent attention-owned package, rather than leaving external systems to call runtime-private commit functions.

Why:

- it makes attention writable while runtime is offline
- it preserves attention as a system boundary rather than a runtime helper
- it allows message-system, future task-system timers, and mounted systems to depend on the same law

Rejected alternative:

- keep runtime as sole writer and make every source wait for runtime startup
  - rejected because it turns durable attention truth into a runtime-liveness side effect

### Decision 2: Runtime becomes a consumer/orchestrator, not the only writer

`SessionRuntime` will continue to:

- restore attention state
- schedule work
- notify the loop
- produce explicit visible effects

But it should stop owning the only durable ingress path for external systems.

Why:

- runtime lifecycle and attention durability are separate concerns
- cold start should recover truth, not recreate it
- inspection should see durable attention even before runtime starts

Rejected alternative:

- duplicate the same write semantics both in runtime and in a new external writer
  - rejected because dual semantic ownership will drift quickly

### Decision 3: Preserve one attention semantics regardless of writer

The new control plane must reuse the same laws for:

- context-preserving vs context-applying mutation
- score projection
- focus state durability
- immutable commit history

Why:

- external commits cannot become a second-class or “raw” variant of attention
- runtime recovery must not reinterpret external writes

Rejected alternative:

- let external systems write looser pre-commits and let runtime normalize later
  - rejected because it recreates lifecycle coupling and weakens durable truth

### Decision 4: Migration is phased and BDD-first

The migration should happen in phases:

1. codify specs and failing BDD around offline attention writes
2. add the attention control plane and package-level tests
3. migrate one real source path first, starting with message follow-up
4. rewire runtime recovery/orchestration
5. clean remaining runtime-owned ingress residue

Why:

- this is a cross-cutting boundary change
- BDD gives a stable external contract while internals move
- a phased rollout lowers risk of semantic drift

Rejected alternative:

- rewrite all source paths in one pass
  - rejected because it hides where the real law is still unclear

### Decision 5: Review checkpoints are first-class deliverables

The change explicitly includes review checkpoints, not just coding tasks:

- Review A: confirm proposal/specs still match the user’s original law before implementation
- Review B: confirm first migrated source path expresses the right durable behavior before expanding scope
- Review C: confirm runtime/UI/inspection surfaces reflect objective attention truth without legacy projection leakage

Why:

- the user explicitly wants repeated realignment against the original goal
- these checkpoints prevent “implementation momentum” from silently redefining the target

## Risks / Trade-offs

- [Boundary split may overlap with existing runtime adapter work] → Keep this change focused on attention ingress ownership, not general workspace-system ownership.
- [New control plane can accidentally duplicate runtime commit semantics] → Extract shared attention-commit application helpers and prove parity with package-level BDD.
- [Migration may leave mixed write paths for a while] → Make phase boundaries explicit in tasks and keep each migrated source behind targeted regression coverage.
- [Inspection/UI may still assume runtime-owned writes] → Add explicit verification tasks for inspection surfaces and any diagnostics that currently imply runtime is the source of truth.

## Migration Plan

1. Write proposal/specs/design/tasks and review them against the user’s original law before implementation.
2. Add failing BDD at `attention-system`, `message-system`, and `app-server` boundaries for offline-write and cold-recovery behavior.
3. Implement the independent attention control plane and shared persistence helpers.
4. Migrate message follow-up to use the new control plane as the first production path.
5. Update runtime startup/recovery to consume offline-written attention truth.
6. Audit and remove remaining runtime-private external ingress ownership residue.
7. Re-run focused verification and perform the final architecture review before archive.

Rollback strategy:

- keep the existing runtime consumer path intact during early phases
- gate new source-path migration behind passing BDD
- if a migrated source path regresses, revert that path to the old write route temporarily without discarding the new specs

## Open Questions

- Should the attention control plane live inside `packages/attention-system` directly, or in a sibling package if runtime kernel orchestration concerns leak too much?
- What is the smallest public API that lets `message-system` and later `task-system` write durable attention truth without importing runtime-only types?
- Which existing diagnostics should move from runtime inspection into attention-owned inspection as part of this separation, and which can stay runtime-local?
