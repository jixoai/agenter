## 0. Vision Alignment

- [x] 0.1 Convert the change to vision-driven intent with `plans/plan.md` as the SSOT.
- [x] 0.2 Add the low-noise expert-operator page principles to durable Studio best-practice docs.
- [x] 0.3 Create a change-local low-noise MCP workbench prototype under `demos/`.
- [x] 0.4 Add spec coverage for HelpHint-based explanation, low persistent body copy, and reduced nested card/border structure.
- [x] 0.5 Run `bun run openspec:vision -- validate add-studio-mcp-system-ui`.
- [x] 0.6 Run `bun run openspec:vision -- commit-check add-studio-mcp-system-ui --phase research-plan` before app-code work starts.

## 1. Runtime Contracts

- [x] 1.1 Add browser-facing MCP input/view types to `@agenter/client-sdk` without importing app-server MCP internals.
- [x] 1.2 Add runtime-store MCP facade methods for global/project projections, add/remove, enable/disable, start/stop/restart, query, and call.
- [x] 1.3 Add daemon/tRPC or descriptor-backed browser routes that forward typed MCP requests to the selected AvatarRuntime's `McpSystemSurface`.
- [x] 1.4 Add BDD tests proving runtime-store methods preserve MCP defaults and return blocked remove, lifecycle error, and structured call outcomes.

## 2. Studio Workbench Shell

- [x] 2.1 Add `/mcp` route and app-shell `MCP` navigation item with active state for nested MCP routes.
- [x] 2.2 Create `apps/studio/src/lib/features/mcp/` module structure for state, mocked fixtures, workbench layout, list, detail, dialogs, and tests.
- [x] 2.3 Implement runtime selector and no-runtime empty state so MCP facts are always scoped to an explicit runtime authority.
- [x] 2.4 Implement project path filter/search with global-only and exact-project projection modes.
- [x] 2.5 Keep the normal `/mcp` surface low-noise: no persistent MCP tutorial copy, no nested card stack, and no repeated borders beyond real shell/detail/row boundaries.

## 3. MCP Workbench Interaction

- [x] 3.1 Implement MCP list-detail UI showing name, transport, enabled/default-disabled state, lifecycle, snapshot counts, and latest error markers.
- [x] 3.2 Implement add/edit global config dialog with stdio, Streamable HTTP, and SSE transport forms.
- [x] 3.3 Implement exact-project enable/disable toggle and lifecycle controls gated by enablement.
- [x] 3.4 Implement remove flow with blocked-project feedback and explicit `stop:true` destructive confirmation.
- [x] 3.5 Implement snapshot detail sections for tools, resources, prompts, server info, timestamps, schemas, and latest action facts using structured-value primitives.
- [x] 3.6 Implement optional tool test-call dialog with explicit `autoEnable` and structured success/error rendering.
- [x] 3.7 Collapse global/project law, auto-start/auto-enable defaults, blocked removal, and stale snapshot explanations into `HelpHint`, tooltips, or focused dialog text instead of body copy.

## 4. Verification

- [x] 4.1 Add Storybook DOM stories/tests for no-runtime, global-only, default-disabled project, enabled stopped, running, failed, blocked-remove, and test-call states.
- [x] 4.2 Add route-level smoke tests for `/mcp` desktop and iPhone 14 compact navigation reachability.
- [x] 4.3 Run `bun run --filter 'agenter-app-studio' test:unit`, `bun run --filter 'agenter-app-studio' test:dom`, and focused client-sdk/app-server tests. Focused MCP/client/app-server tests passed; full Studio unit/dom were run and currently fail on unrelated runtime/notes/message/terminal stories.
- [x] 4.4 Update `openspec/specs/studio-product/spec.md`, `openspec/specs/client-runtime-store/spec.md`, and package-level durable docs before archive.
- [x] 4.5 Run `bun run openspec:vision -- validate add-studio-mcp-system-ui` and `openspec validate --specs --strict`.
- [x] 4.6 Update `New` to support explicit add + enable + start for the selected exact project without changing global default-disabled semantics.
