## 1. Session route canonicalization

- [ ] 1.1 Replace WebUI session route definitions with `/session/$sessionId/{chats,terminals,settings,devtools}` topology.
- [ ] 1.2 Remove legacy `/workspace/*?sessionId=*` runtime routes from the router tree.
- [ ] 1.3 Update in-app navigation (quick start, workspaces, shell tabs, running-session rail) to session paths.

## 2. Terminal activity invocation parity

- [ ] 2.1 Ensure terminal activity legacy YAML tool rows map through `ToolInvocationCard`.
- [ ] 2.2 Ensure empty tool input payloads are visually omitted.

## 3. Verification

- [ ] 3.1 Update route-related unit/e2e tests to canonical session path expectations.
- [ ] 3.2 Run `bun run --filter '@agenter/webui' test:unit`.
- [ ] 3.3 Run `bun run --filter '@agenter/webui' test:dom`.
