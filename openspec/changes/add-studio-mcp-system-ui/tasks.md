## 1. Runtime Contracts

- [ ] 1.1 Add browser-facing MCP input/view types to `@agenter/client-sdk` without importing app-server MCP internals.
- [ ] 1.2 Add runtime-store MCP facade methods for global/project projections, add/remove, enable/disable, start/stop/restart, query, and call.
- [ ] 1.3 Add daemon/tRPC or descriptor-backed browser routes that forward typed MCP requests to the selected AvatarRuntime's `McpSystemSurface`.
- [ ] 1.4 Add BDD tests proving runtime-store methods preserve MCP defaults and return blocked remove, lifecycle error, and structured call outcomes.

## 2. Studio Workbench Shell

- [ ] 2.1 Add `/mcp` route and app-shell `MCP` navigation item with active state for nested MCP routes.
- [ ] 2.2 Create `packages/studio/src/lib/features/mcp/` module structure for state, mocked fixtures, workbench layout, list, detail, dialogs, and tests.
- [ ] 2.3 Implement runtime selector and no-runtime empty state so MCP facts are always scoped to an explicit runtime authority.
- [ ] 2.4 Implement project path filter/search with global-only and exact-project projection modes.

## 3. MCP Workbench Interaction

- [ ] 3.1 Implement MCP list-detail UI showing name, transport, enabled/default-disabled state, lifecycle, snapshot counts, and latest error markers.
- [ ] 3.2 Implement add/edit global config dialog with stdio, Streamable HTTP, and SSE transport forms.
- [ ] 3.3 Implement exact-project enable/disable toggle and lifecycle controls gated by enablement.
- [ ] 3.4 Implement remove flow with blocked-project feedback and explicit `stop:true` destructive confirmation.
- [ ] 3.5 Implement snapshot detail sections for tools, resources, prompts, server info, timestamps, schemas, and latest action facts using structured-value primitives.
- [ ] 3.6 Implement optional tool test-call dialog with explicit `autoEnable` and structured success/error rendering.

## 4. Verification

- [ ] 4.1 Add Storybook DOM stories/tests for no-runtime, global-only, default-disabled project, enabled stopped, running, failed, blocked-remove, and test-call states.
- [ ] 4.2 Add route-level smoke tests for `/mcp` desktop and iPhone 14 compact navigation reachability.
- [ ] 4.3 Run `bun run --filter '@agenter/studio' test:unit`, `bun run --filter '@agenter/studio' test:dom`, and focused client-sdk/app-server tests.
- [ ] 4.4 Update `openspec/specs/studio-product/spec.md`, `openspec/specs/client-runtime-store/spec.md`, and package-level durable docs before archive.
- [ ] 4.5 Run `openspec validate add-studio-mcp-system-ui --strict` and `openspec validate --specs --strict`.
