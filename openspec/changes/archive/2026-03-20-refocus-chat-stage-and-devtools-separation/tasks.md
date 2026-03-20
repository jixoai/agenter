## 1. Chat-first workspace shell

- [x] 1.1 Compact `WorkspaceShellFrame` so workspace identity is supporting chrome instead of a large competing card above the route surface
- [x] 1.2 Update workspace-route status derivation so Chat receives one actionable status summary instead of stacked passive or vague error surfaces
- [x] 1.3 Ensure the global header and compact drawer remain passive while route-local notices stay inside Chat or Devtools

## 2. Conversation-first Chat surface

- [x] 2.1 Refactor `ChatPanel` to render a conversation-first stream from cycle-backed data without default cycle cards or collected-facts sections
- [x] 2.2 Keep one primary session action and shared AI input as the dominant controls in Chat, with improved empty or stopped-session guidance
- [x] 2.3 Normalize generic fallback errors such as `Unknown error` into stable route-level status copy

## 3. Devtools ownership

- [x] 3.1 Refactor the Devtools route tabs so cycle/process inspection lives there instead of in Chat
- [x] 3.2 Add or reshape the cycle-oriented Devtools panel so collected facts, internal assistant records, and related inspection content remain available

## 4. Verification

- [x] 4.1 Update Storybook stories and DOM tests for the new Chat, Devtools, and compact workspace shell hierarchy
- [x] 4.2 Update unit and integration tests for conversation-first chat rendering and the single-summary status contract
- [x] 4.3 Run focused WebUI validation (`test:unit`, `test:dom`, `build`, and browser review) and fix regressions until the change is ready
