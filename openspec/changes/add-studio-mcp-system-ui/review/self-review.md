# Vision-Driven Self Review

## Review State

- Change: `add-studio-mcp-system-ui`
- Iteration: 2
- Recurring issue counts: none
- Exit-condition judgment: architecture correction exit; MCP is now Avatar-owned and no-running-AvatarRuntime operation is verified
- Next loop action: wait for operator review before archive

## Intent Alignment

| Intent point                                                                                | Evidence                                                                                                                                                               | Verdict |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| MCP page is an expert operator workbench, not a tutorial/settings page                      | `DESIGN.md`, `.agents/skills/develop-agenter/references/studio-ui.md`, `apps/studio/SPEC.md`, route contract scenario for low-noise HelpHint usage                     | Aligned |
| The page exposes config owner, config truth, and Avatar-owned instance projection distinctly | `apps/studio/src/lib/features/mcp/mcp-route.svelte`, `mcp-workbench-state.ts`, `mcp-config-list.svelte`, `mcp-avatar-overview.svelte`, route contract ownership scenario | Aligned |
| MCP home has `Configs / Avatars` page-toolbar tabs                                              | `mcp-route.svelte`, `openspec/specs/studio-product/spec.md`, `openspec/changes/add-studio-mcp-system-ui/specs/studio-mcp-system-workbench/spec.md`                        | Aligned |
| Studio consumes Avatar-owned MCP facts through typed browser contracts                      | `packages/client-sdk/src/types.ts`, `packages/client-sdk/src/runtime-store.ts`, `packages/app-server/src/trpc/router.ts`, `mcp-route-contract.spec.ts`                 | Aligned |
| SessionRuntime does not own MCP durable truth                                               | `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/app-kernel.ts`, `packages/app-server/test/trpc-router.test.ts`                                  | Aligned |
| Global config creation remains inert unless project enablement/start is explicit            | `mcp-new-global-form.svelte`, `mcp-route.svelte`, `mcp-system` and Studio specs                                                                                        | Aligned |
| Config detail reuses one new/edit form and shows read-only instance rows                    | `mcp-new-global-form.svelte`, `mcp-route.svelte`, Storybook `ConfigDetailEdit`, route smoke coverage                                                                    | Aligned |
| Avatars tab expresses ownership with standard avatar affordance and without reintroducing config mutation | `mcp-avatar-overview.svelte`, `mcp-route.svelte`, Storybook `AvatarsOverview`                                                                                           | Aligned |
| Desktop and iPhone 14 route reachability are proven                                         | `apps/studio/tests/e2e/mcp-workbench.e2e.ts`; command passed for desktop-chromium and mobile-iphone14                                                                  | Aligned |

## Deviations From Intent

1. Full Studio `test:unit` and `test:dom` do not pass in this dirty checkout. The failing files after MCP scroll-law cleanup are outside the MCP change: runtime/notes scroll-contract hits and message/terminal Storybook failures.
2. The OpenSpec instruction says a normal self-review exit can archive immediately. This review stops before archive to preserve the repo's separate commit boundary for implementation/spec sync versus archive.

## New Questions For User

1. Should `/mcp` expose the read-only SQL query surface as an advanced dialog in the next loop, or keep SQL entirely outside the first operator page?

Resolved follow-up: the operator confirmed new/edit should stay on the config surface and still support explicit add -> enable -> start for one exact project path, preserving global default-disabled semantics.

Resolved architecture correction: the operator rejected `SessionRuntime.mcpSystem` and running-AvatarRuntime ownership. MCP is now resolved by selected Avatar authority; `SessionRuntime` can only receive an optional projection surface for root-workspace CLI/API exposure and does not create, store, close, or own MCP durable facts.

## Evidence

- HTML report: `review/self-review.html`
- Focused MCP route contract: `bun test apps/studio/src/lib/features/mcp/mcp-route-contract.spec.ts` passed.
- Focused MCP Storybook DOM: `bun run --filter 'agenter-app-studio' test:dom -- test/storybook/mcp-workbench.stories.test.ts` passed.
- Client runtime-store MCP facade: `bun test packages/client-sdk/test/runtime-store.test.ts -t "MCP TRPC outcomes"` passed.
- App-server tRPC no-runtime MCP smoke: `bun test packages/app-server/test/trpc-router.test.ts -t "Avatar-owned MCP"` passed.
- MCP lifecycle: `bun test packages/app-server/test/mcp-system-lifecycle.test.ts` passed.
- MCP transports: `bun test packages/app-server/test/mcp-system-transports.test.ts` passed.
- Route smoke: `cd apps/studio && bunx playwright test tests/e2e/mcp-workbench.e2e.ts` passed on desktop-chromium and mobile-iphone14.
- Route smoke with trace evidence: `cd apps/studio && bunx playwright test tests/e2e/mcp-workbench.e2e.ts --trace=on` passed on desktop-chromium and mobile-iphone14; traces are under `apps/studio/test-results/*/trace.zip`.
- OpenSpec change validation: `bun run openspec:vision -- validate add-studio-mcp-system-ui` passed.
- Durable spec validation: `openspec validate --specs --strict` passed, 186 specs.
- Full Studio unit: `bun run --filter 'agenter-app-studio' test:unit` failed only on non-MCP scroll-contract violations after cleanup.
- Full Studio DOM: `bun run --filter 'agenter-app-studio' test:dom` failed in non-MCP message/terminal stories and a virtual env import.
- Git commits reviewed: none yet; this review is over the current working tree before the implementation commit.
- Uncommitted paths: MCP/OpenSpec/doc paths for this change plus unrelated Notes/Heartbeat/WebHeartbeat worktree changes. Only MCP/OpenSpec/doc paths should be staged for this commit.
- Task checkboxes updated by this working context: `4.3`, `4.4`, `4.5`, `4.6`, `4.7`.

## Exit Handling

- Normal apply exit reached: all 27 apply tasks are complete and `openspec instructions apply --change add-studio-mcp-system-ui --json` reports `state: all_done`.
- Archive is intentionally deferred to a separate archive commit.
