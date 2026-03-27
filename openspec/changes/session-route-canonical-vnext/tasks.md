## 1. Session route canonicalization

- [x] 1.1 Replace WebUI session route definitions with `/session/$sessionId/{chats,terminals,settings,devtools}` topology.
- [x] 1.2 Remove legacy `/workspace/*?sessionId=*` runtime routes from the router tree.
- [x] 1.3 Update in-app navigation (quick start, workspaces, shell tabs, running-session rail) to session paths.

## 2. Terminal activity invocation parity

- [x] 2.1 Ensure terminal activity legacy YAML tool rows map through `ToolInvocationCard`.
- [x] 2.2 Ensure empty tool input payloads are visually omitted.

## 3. Verification

- [x] 3.1 Update route-related unit/e2e tests to canonical session path expectations.
- [x] 3.2 Run `bun run --filter '@agenter/webui' test:unit`.
- [x] 3.3 Run `bun run --filter '@agenter/webui' test:dom`.

### Verification log

- `bun run --filter '@agenter/webui' test:unit`
- `bun run --filter '@agenter/webui' test:dom`
