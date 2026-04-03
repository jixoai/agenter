## Context

The archived React operator UI already had a richer message-system surface built around `@agenter/web-chat-view`. The active Svelte route replaced it with a local transcript implementation that is easier to scaffold but no longer satisfies the operator workflow or the reusable component strategy for future user-facing WebUI work.

## Goals / Non-Goals

**Goals:**
- Rebuild `Messages` as a live operator room surface
- Migrate `@agenter/web-chat-view` to a framework-agnostic Svelte custom element
- Keep room/user/access truth owned by message-system and auth/profile truth

**Non-Goals:**
- Introduce task-system coupling into room UI
- Recreate every React helper one-to-one if Svelte primitives can replace it cleanly
- Build the future user-webui in this change

## Decisions

### Migrate the shared chat package to a Svelte custom element
`@agenter/web-chat-view` will remain the shared room transcript/composer package, but it will export a custom element and a thin Svelte host wrapper instead of React components. This keeps reuse viable across multiple frontends.

### Move room state to subscription-backed store slices
The client store will own global room catalogs, selected room snapshots, grants, and read-state slices. The `Messages` route will render selectors rather than running its own polling loops.

### Keep operator-only chrome outside the shared chat package
The shared `web-chat-view` handles transcript, composer, and pagination. Operator-only concerns such as room lists, users/access sidebars, metadata dialogs, and send-as actor selectors stay in `@agenter/webui`.

## Risks / Trade-offs

- [Risk] Rebuilding the shared chat package in Svelte can temporarily reduce parity with the React package. -> Mitigation: port the transport contract first and reuse existing behavioral tests as BDD acceptance cases.
- [Risk] Room-level subscriptions add more moving pieces to `RuntimeStore`. -> Mitigation: keep one live resource map per room and centralize subscription lifecycle in the store.
- [Risk] Custom element packaging can drift from Svelte host usage. -> Mitigation: expose a host wrapper that the operator route uses directly and test both the element and the host path.
