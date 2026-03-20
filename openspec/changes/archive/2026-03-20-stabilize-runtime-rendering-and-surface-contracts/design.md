## Context

`packages/client-sdk/src/runtime-store.ts` currently emits a fresh top-level `RuntimeClientState` to React for every hot runtime event, and `packages/webui/src/App.tsx` mirrors that state into one large React tree. The supplied performance trace shows bursty websocket activity and repeated renders through `ChatPanel`, `AIInput`, `CodeMirror`, and shell surfaces during a short interaction window. Separately, `overflow-hidden` cleanup introduced primitives, but background ownership is still implicit, especially where rounded surfaces and clipping wrappers are combined.

## Goals / Non-Goals

**Goals:**
- Reduce full-tree rerender pressure by moving WebUI runtime reads onto narrow selector subscriptions.
- Coalesce hot runtime event publication without losing facts or transport correctness.
- Formalize which primitives may own background, clipping, and scroll behavior.
- Add stable regression tests for render isolation and source-level layout contracts.

**Non-Goals:**
- Rewriting the transport protocol or changing LoopBus semantics.
- Redesigning Chat or Devtools feature scope; those changes belong to the separate ChatApp change.
- Introducing a global client state library beyond the current runtime store and React integration.

## Decisions

- Add selector-oriented runtime hooks on top of `RuntimeStore` rather than replacing the store implementation wholesale. This keeps transport logic in one place while isolating React subscriptions by slice.
- Batch hot store publication on an animation-frame or microtask boundary for runtime event bursts, but keep state mutation eager. This preserves correctness while reducing React commit frequency.
- Move `AppControllerContext` toward stable commands plus lightweight derived state, and let route features subscribe directly to the slices they render.
- Extend the overflow primitives into a stricter surface contract: layout wrappers stay transparent, scroll wrappers own scrolling only, clip surfaces own clipping only, and semantic surfaces own background/radius/elevation.
- Enforce the layout contract with source tests instead of relying on review memory.

## Risks / Trade-offs

- [Selector migration misses a hot path] → Add targeted render-isolation tests around shell, Chat, and Devtools state reads before refactoring more surfaces.
- [Batched publication hides an ordering bug] → Mutate store state eagerly and only batch listener notification, so consumers always observe the latest consistent snapshot.
- [Background contract is too strict for legitimate media/terminal cases] → Keep a narrow allowlist through semantic surface primitives and clip-surface exceptions.
- [Dev mode still looks noisy because React/DevTools add overhead] → Validate both dev and production, but optimize the actual rerender graph so prod and dev both improve materially.
