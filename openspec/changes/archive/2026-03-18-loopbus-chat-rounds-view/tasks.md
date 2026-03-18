## 1. Round projection and runtime events

- [x] 1.1 Add `ChatRound` projection helpers plus session-db and app-kernel queries for cycle-based round history.
- [x] 1.2 Extend `SessionRuntime` and model streaming so the active round is emitted through realtime events until the cycle settles.

## 2. Client round timeline state

- [x] 2.1 Extend TRPC and client-sdk types/store to load round pages, merge live rounds, and replace optimistic sends by `clientMessageId`.
- [x] 2.2 Preserve the flat chat message projection for non-chat consumers while making the main chat state consume round data.

## 3. WebUI round chat experience

- [x] 3.1 Update the Chat panel to render round entries, merged tool activity, streaming output, and cycle-rail navigation.
- [x] 3.2 Verify the round timeline through app-server, client-sdk, WebUI unit, and Storybook DOM tests.
