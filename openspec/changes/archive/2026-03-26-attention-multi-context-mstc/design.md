## Context

The attention-system is the architectural kernel of Agenter. All external inputs (user messages, terminal output, task events) are transformed into attention items before the LoopBus decides whether to start a model cycle. Currently this kernel is a flat scored-fact list that cannot express the multi-dimensional, multi-context, relationship-tracking semantics required by the product vision.

Existing building blocks:
- `AttentionEngine` provides add/list/query/remark/update with single-score semantics.
- `AttentionStore` handles atomic JSON persistence with write queue.
- `LoopBusPluginRuntime` provides the attention-first hook pipeline (attentionWillLoad → attentionTransform → attentionCommitted → cycleShouldStart).
- `SessionRuntime` bridges attention to LoopBus inputs and model tool calls.

## Goals / Non-Goals

**Goals:**
- Replace the flat scored-fact model with M+S+T+C structured items.
- Enable multiple attention contexts per system, each owned by an avatar.
- Support hash-based relationship tracking across items and contexts.
- Add subscription mechanism for external system integration.
- Preserve full backward compatibility via AttentionEngine facade.

**Non-Goals:**
- Modify LoopBus core plugin pipeline in this change (output hooks are a separate concern).
- Implement session-runtime integration in this change (separate follow-up).
- Build chat-channel routing in this change (depends on attention subscription foundation).

## Decisions

### M+S+T+C replaces flat content+score
Each attention item carries Meta (who/when/extensible), Scores (hash→score map), Title (surface text), and Context (internal detail). This separates communication from reasoning and enables multi-concern tracking per item.

Why: a single `score: number` cannot track progress on multiple related concerns simultaneously.

### Scores use Record<string, number> not Map
JSON serialization and persistence require plain objects. Map would require custom ser/de.

Why: attention state is frequently persisted and transmitted over WebSocket.

### AttentionContext is the unit of ownership
Each context is bound to an owner (avatar name). This maps naturally to chat-channels, terminals, and task queues each getting their own context.

Why: the avatar concept in Agenter requires scoped attention management.

### AttentionEngine becomes a facade
The existing public API (add/list/query/remark/update/snapshot) is preserved by delegating to a "default" context in the new AttentionSystem. All existing callers (session-runtime, tests) work unchanged.

Why: backward compatibility is critical — session-runtime has ~20 call sites.

### V1→V2 migration is automatic
When AttentionStore loads a V1 snapshot (flat records), it migrates all records into a default context. No manual migration step needed.

Why: existing deployments must upgrade seamlessly.

## Risks / Trade-offs

- [Facade overhead] → AttentionEngine facade adds one level of indirection; negligible at current scale.
- [ID format change] → New items use string IDs; facade maps to numeric IDs for backward compat. Existing numeric ID semantics preserved in facade layer.
- [Snapshot size] → Multi-context snapshots are larger; mitigated by the fact that most deployments will have 1-3 contexts.

## Dependencies and Handoff

**Inbound dependencies:** none. This is the base attention-system change.

**Outbound handoff:**
- `session-runtime-attention-integration` consumes AttentionSystem and attention gateway extensions.
- `loopbus-output-hooks` may use attention subscription to route outputs.
- `chat-channel-refactoring` consumes context subscription for AI reply routing.
