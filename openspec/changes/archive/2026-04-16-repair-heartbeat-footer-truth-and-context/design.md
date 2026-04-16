## Context

Heartbeat already has the right durable ingredients, but the footer still consumes them through the wrong ownership boundaries. The WebUI infers its main status from the newest model call, the grouped Heartbeat slice has no explicit resource state, and manual compact only exists as an internal runtime affordance rather than a UI-facing action. On the provider side, settings only carry transport/runtime knobs, so the footer cannot show max-context usage or even an estimated price.

This change crosses `app-server`, `client-sdk`, `settings`, and `webui`, and it touches both runtime publication law and operator inspection law. That makes a design doc useful because we need to keep control actions, durable facts, and derived UI projections clearly separated.

## Goals / Non-Goals

**Goals:**
- Give Heartbeat one objective footer truth source by separating scheduler status, grouped Heartbeat resource state, and provider metadata responsibilities.
- Expose manual compact as a formal runtime action instead of a fake chat-message hack.
- Extend canonical provider metadata so operator surfaces can show max-context and estimated cost without pretending those numbers are exact.
- Repair grouped Heartbeat virtualization so disclosure changes remeasure row height instead of leaving stale whitespace.

**Non-Goals:**
- No chat-surface redesign and no change to durable Heartbeat message-part semantics.
- No exact billing engine; the footer only computes an estimate when provider metadata is available.
- No second config editor inside Heartbeat for provider pricing bands; pricing remains a settings/schema concern.
- No backward-compatible dual state shape for Heartbeat groups; the grouped slice will move directly to cached resource state.

## Decisions

### 1. Heartbeat groups become a cached resource, not a bare array

Upgrade `heartbeatGroupsBySession` to `CachedResourceState<HeartbeatGroupItem[]>` and let hydration, refresh invalidation, and older-page loading mutate one shared state object.

Why:
- Loading, empty, refreshing, and error are real facts, not presentational guesses.
- The current `[]` default collapses three different states into one blank panel.
- The store already uses `CachedResourceState` for other heavy resources, so Heartbeat should obey the same law.

Alternatives considered:
- Keep the array shape and thread ad hoc `loading` booleans through `runtime-shell`.
- Rejected because it duplicates resource-state logic in UI components and still loses refresh/error semantics.

### 2. Manual compact is a runtime action, not a chat command

Add `runtime.requestCompact({ sessionId })` from TRPC through client-sdk into app-server, and expose a public runtime method that queues `requestCompact("manual")`.

Why:
- Compact is a control-plane action, not user-authored transcript content.
- It preserves the existing compact-cycle law while making WebUI a first-class caller.
- It keeps `/compact` available as an AI/user chat convention without making UI depend on message injection.

Alternatives considered:
- Have the footer send `/compact` through chat input.
- Rejected because it pollutes durable content truth with UI control intent.

### 3. Footer status text is driven by scheduler containment, not model-call heuristics

Use `runtime.schedulerState.runtimeStatus` and `waitingReason` as the only authority for the footer's leading status label. Model-call state remains secondary and only refines the wording for active provider work.

Why:
- The scheduler is the runtime's control-plane truth.
- The latest model call can be absent, stale, or already finished while the runtime is still legitimately waiting or backoff-bound.
- The operator asked for objective facts, not inference.

Alternatives considered:
- Keep using the latest model-call `running` flag because it is already in the footer selector.
- Rejected because it cannot distinguish waiting on external input, attention debt, backoff, pause, and true active generation.

### 4. Provider metadata adds optional context-window and pricing bands

Extend canonical provider settings with optional `maxContextTokens` plus `pricing.currency` and `pricing.bands[]`. Each band expresses `upToTokens`, `inputPerMillion`, optional `cachedInputPerMillion`, and `outputPerMillion`.

Why:
- Max-context and cost belong to provider metadata, not runtime call knobs.
- Tiered pricing is now common, so one flat price field would be incorrect by design.
- The footer only needs enough structure to compute a conservative estimate from usage.

Alternatives considered:
- Put pricing on `ai.*` global runtime config or in a Heartbeat-local setting.
- Rejected because price and context window are provider properties, not per-call knobs.

### 5. Heartbeat cost stays explicitly estimated

The footer computes estimated cost from usage plus provider pricing bands. If cached-hit token facts are unavailable, prompt tokens are priced as uncached input. If metadata is incomplete, the cost surface is disabled or hidden while token usage can still render.

Why:
- Current provider/runtime facts are insufficient for exact billing.
- A missing cached-hit breakdown must not lead to fake precision.
- The operator explicitly asked for an estimate only.

### 6. Heartbeat virtualization switches to dynamic measurement

Keep the grouped virtual list, but enable `measureElement` so expand/collapse and layout-mode toggles feed real row height back into `ScrollView`/TanStack Virtual.

Why:
- The current static estimator is good for initial mount only.
- Disclosure state changes invalidate that estimate and produce the blank-space bug.
- The platform already supports dynamic measurement, and other long lists in the repo use it.

Alternatives considered:
- Remove expansion or disable virtualization.
- Rejected because both would regress readability or performance instead of fixing the measurement law.

## Risks / Trade-offs

- [Heartbeat resource-state migration touches many selectors and tests] → Mitigation: change the state shape once in `client-sdk`, then update all consumers in one pass and keep helper accessors for the common `data` path.
- [Manual compact action could race with an already pending compact cycle] → Mitigation: reuse the runtime's existing pending-compact semantics and keep the mutation idempotent from the caller's perspective.
- [Provider pricing schema may be partially configured in real settings files] → Mitigation: make metadata fully optional and keep the footer in a disabled/unavailable state when required fields are missing.
- [Dynamic measurement can increase virtual-list work] → Mitigation: keep paging at 5 groups, measure only mounted rows, and preserve estimate-size fallback for initial mount.
- [Hydration currently swallows Heartbeat fetch failures inside a large `Promise.all`] → Mitigation: split Heartbeat resource updates so first-load error and warm-refresh failure become explicit resource-state transitions.
