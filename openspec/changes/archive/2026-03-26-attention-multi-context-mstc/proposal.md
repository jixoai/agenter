## Why

The current attention-system is a flat, single-dimension scored-fact list (`AttentionEngine` with `Map<number, AttentionRecord>`). Every attention item has one `score: number` and one `content: string`, making it impossible to track multiple concerns per item, express relationship chains between items, separate surface communication from internal reasoning, or run multiple attention contexts in parallel.

Agenter's architecture requires attention as the central runtime kernel — all inputs (chat, terminal, task) flow through attention, and all outputs route back through attention subscriptions. The flat model cannot support this.

## What Changes

- Introduce the M+S+T+C attention-item model: Meta (extensible metadata), Scores (multi-hash `Record<string, number>`), Title (surface summary), Context (internal detail).
- Introduce multi-context management: each `AttentionContext` is a notebook bound to an owner (avatar), containing attention-items that evolve through entropy reduction.
- Add hash-based relationship tracking: items sharing the same hash key in their Scores map form relationship chains queryable by depth.
- Add context subscription: external systems (chat-channels, terminals) subscribe to context changes with filters.
- Preserve backward compatibility: `AttentionEngine` becomes a facade delegating to a default context in the new `AttentionSystem`.

## Capabilities

### New Capabilities
- `attention-item-mstc`: M+S+T+C structured attention items with multi-hash scoring and relationship tracking.
- `attention-multi-context`: Multiple attention contexts per system, each owned by an avatar, with cross-context queries.
- `attention-context-subscription`: Event-driven subscription for context changes, enabling chat-channel and terminal integration.

### Modified Capabilities
- `attention-query-threshold`: Query semantics extend to multi-hash scoring — an item is "active" when any score value > 0.
- `attention-source-plugins`: Source adapters produce attention-items with M+S+T+C structure into specific contexts.

## Impact

- Affected code: `packages/attention-system`, `packages/app-server` (session-runtime, loop-bus).
- Affected APIs: AttentionEngine constructor/snapshot format, attention gateway in session-runtime.
- Affected tests: `attention-engine.test.ts` (must pass unchanged via facade).

## Delivery Order

1. Land attention-item M+S+T+C types and AttentionContext engine.
2. Land AttentionSystem multi-context manager.
3. Upgrade AttentionStore with V2 snapshot format and V1 migration.
4. Rewrite AttentionEngine as facade over AttentionSystem default context.
5. Add context subscription mechanism.
6. Integrate with session-runtime (future change).
