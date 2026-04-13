## 1. Contract

- [x] 1.1 Record Heartbeat compact separator behavior in change artifacts and durable specs

## 2. Implementation

- [x] 2.1 Persist compact cycle boundaries as `scope=heartbeat` special message parts and project them into the runtime heartbeat row stream
- [x] 2.2 Update runtime/public/client types and merge logic so Heartbeat rows can include compact separators without breaking pagination or live updates
- [x] 2.3 Render compact separators in the Svelte Heartbeat surface with a dedicated primitive instead of a normal message bubble

## 3. Validation

- [x] 3.1 Add app-server regression coverage for persisted compact boundary rows and projection order
- [x] 3.2 Add Storybook DOM coverage for Heartbeat compact separators and rerun focused app-server/webui validation
