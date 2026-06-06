# Vision-Driven Self Review

## Review State

- Change: `add-studio-mcp-system-ui`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: normal apply exit; implementation is ready for archive after a separate archive decision
- Next loop action: archive the change in a separate commit after the operator accepts the apply result

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| MCP page is an expert operator workbench, not a tutorial/settings page | `DESIGN.md`, `.agents/skills/develop-agenter/references/studio-ui.md`, `apps/studio/SPEC.md`, route contract scenario for low-noise HelpHint usage | Aligned |
| The page exposes runtime authority, global registry, and exact-project projection distinctly | `apps/studio/src/lib/features/mcp/mcp-route.svelte`, `mcp-workbench-state.ts`, `mcp-server-list.svelte`, `mcp-server-detail.svelte`, route contract ownership scenario | Aligned |
| MCP home has `List / New` page-toolbar tabs | `mcp-route.svelte`, `openspec/specs/studio-product/spec.md`, `openspec/changes/add-studio-mcp-system-ui/specs/studio-mcp-system-workbench/spec.md` | Aligned |
| Studio consumes runtime-owned MCP facts through typed browser contracts | `packages/client-sdk/src/types.ts`, `packages/client-sdk/src/runtime-store.ts`, `packages/app-server/src/trpc/router.ts`, `mcp-route-contract.spec.ts` | Aligned |
| Global config creation remains inert unless project enablement is explicit | `mcp-new-global-form.svelte`, `mcp-route.svelte`, `mcp-system` and Studio specs | Aligned |
| Snapshot and invocation output are structured, bounded projections | `mcp-server-detail.svelte`, `StructuredValueViewer`, Storybook DOM coverage | Aligned |
| Desktop and iPhone 14 route reachability are proven | `apps/studio/tests/e2e/mcp-workbench.e2e.ts`; command passed for desktop-chromium and mobile-iphone14 | Aligned |

## Deviations From Intent

1. Full Studio `test:unit` and `test:dom` do not pass in this dirty checkout. The failing files after MCP scroll-law cleanup are outside the MCP change: runtime/notes scroll-contract hits and message/terminal Storybook failures.
2. The OpenSpec instruction says a normal self-review exit can archive immediately. This review stops before archive to preserve the repo's separate commit boundary for implementation/spec sync versus archive.

## New Questions For User

1. Should `/mcp` expose the read-only SQL query surface as an advanced dialog in the next loop, or keep SQL entirely outside the first operator page?
2. Should `New` allow an explicit one-step "create global + enable current project" flow long term, or should project enablement always happen from `List` detail after the inert global exists?

## Evidence

- HTML report: `review/self-review.html`
- Focused MCP route contract: `bun test apps/studio/src/lib/features/mcp/mcp-route-contract.spec.ts` passed.
- Focused MCP Storybook DOM: `bun run --filter 'agenter-app-studio' test:dom -- test/storybook/mcp-workbench.stories.test.ts` passed.
- Client runtime-store MCP facade: `bun test packages/client-sdk/test/runtime-store.test.ts -t "MCP TRPC outcomes"` passed.
- App-server tRPC focused smoke: `bun test packages/app-server/test/trpc-router.test.ts -t "caller creates session"` passed.
- Route smoke: `cd apps/studio && bunx playwright test tests/e2e/mcp-workbench.e2e.ts` passed on desktop-chromium and mobile-iphone14.
- OpenSpec change validation: `bun run openspec:vision -- validate add-studio-mcp-system-ui` passed.
- Durable spec validation: `openspec validate --specs --strict` passed, 186 specs.
- Full Studio unit: `bun run --filter 'agenter-app-studio' test:unit` failed only on non-MCP scroll-contract violations after cleanup.
- Full Studio DOM: `bun run --filter 'agenter-app-studio' test:dom` failed in non-MCP message/terminal stories and a virtual env import.
- Git commits reviewed: none yet; this review is over the current working tree before the implementation commit.
- Uncommitted paths: MCP/OpenSpec/doc paths for this change plus unrelated Notes/Heartbeat/WebHeartbeat worktree changes. Only MCP/OpenSpec/doc paths should be staged for this commit.
- Task checkboxes updated by this working context: `4.3`, `4.4`, `4.5`.

## Exit Handling

- Normal apply exit reached: all 27 apply tasks are complete and `openspec instructions apply --change add-studio-mcp-system-ui --json` reports `state: all_done`.
- Archive is intentionally deferred to a separate archive commit.
