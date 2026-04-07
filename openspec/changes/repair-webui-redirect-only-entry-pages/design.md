## Context

The current WebUI uses redirect-only `+page.ts` files for several route entries:

- `/` -> `/avatars`
- `/avatars` -> `/avatars/workspace`
- `/avatars/runtime/[sessionId]` -> `/avatars/runtime/[sessionId]/attention`

The browser walkthrough shows a repeated failure pattern: opening those entry URLs yields `500 Internal Error`, while the final child URLs themselves still render correctly. That means the feature surfaces are mostly intact, but the route-entry law is broken.

## Goals / Non-Goals

**Goals:**

- Restore stable direct-load and in-app navigation behavior for redirect-only entry pages.
- Apply one durable route-entry rule that can cover root entries and nested runtime entries consistently.
- Add regression coverage that proves browser navigation lands on the canonical route instead of erroring.

**Non-Goals:**

- Redesign the Avatars workspace UI or sidebar behavior.
- Change the canonical destination routes themselves.
- Introduce a generic navigation abstraction beyond what is required for redirect-only entries.

## Decisions

### Use server entry routes for redirect-only pages

The verified failure is specific to browser navigation through redirect-only `+page.ts` entries. The repair will move these entry routes to server entry pages so SvelteKit resolves the redirect before the client route tries to render an intermediate page state.

Alternative considered:

- Keep universal `+page.ts` redirects and patch the client shell around them.
  Why rejected: it treats the symptom instead of the route law, and it leaves every new redirect-only entry vulnerable to the same regression.

### Treat entry redirects as route law, not feature code

The affected redirects belong to route assembly, not to the Avatars or runtime features themselves. The repair will keep the canonical destination in the route layer and avoid adding `goto()` fallbacks inside workbench components.

Alternative considered:

- Trigger `goto()` from feature mounts or shell effects.
  Why rejected: that pollutes feature code with route bootstrap glue and risks flashes, loops, and history bugs.

### Verify with real browser navigation plus focused source-level regression

The original failure only surfaced in browser walkthroughs. The fix therefore requires direct browser proof for `/`, `/avatars`, and `/avatars/runtime/[sessionId]`, plus a focused route-level regression check so the redirect-only entry law remains visible in code review.

## Risks / Trade-offs

- [Risk] Server-only entry redirects can hide client-only routing mistakes if used too broadly. -> Mitigation: restrict this pattern to true redirect-only entry pages with canonical child destinations.
- [Risk] Nested runtime entry redirects may still regress if the canonical tab path changes. -> Mitigation: keep the redirect target explicit and cover it with a focused route regression.
- [Risk] Real browser proof may depend on a running local backend. -> Mitigation: record route-level evidence from the live walkthrough and keep the regression test focused on routing semantics.
