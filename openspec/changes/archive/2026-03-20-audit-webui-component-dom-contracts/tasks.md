## 1. OpenSpec contracts

- [x] 1.1 Add delta specs for reusable ChatApp subcomponents, Devtools panel decomposition, and explicit scroll ownership.
- [x] 1.2 Keep the proposal and design aligned with the current dirty WebUI scope only.

## 2. Chat surface decomposition

- [x] 2.1 Split transcript bubble rendering into reusable bubble/action primitives while keeping the current Chat route behavior stable.
- [x] 2.2 Add independent stories and Storybook DOM contracts for pending attachments, persisted attachment strips, and transcript bubble actions.
- [x] 2.3 Keep `ChatConversationViewport` as the transcript scroll owner while preserving long-history and live-turn behavior.

## 3. Devtools / LoopBus decomposition

- [x] 3.1 Split `LoopBusPanel` into smaller flow/trace/model sections without changing its public props contract.
- [x] 3.2 Add Storybook DOM coverage for LoopBus tab switching and long-content affordances.

## 4. Verification

- [x] 4.1 Run focused unit coverage for touched Chat and LoopBus surfaces.
- [x] 4.2 Run `bun run --filter '@agenter/webui' test:dom` after the new stories/contracts land.
