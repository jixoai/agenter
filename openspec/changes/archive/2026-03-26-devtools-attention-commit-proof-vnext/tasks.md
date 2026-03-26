## 1. Selector and view-model update

- [x] 1.1 Update client-sdk and runtime selectors to publish context state, commit history, and hook outcomes.
- [x] 1.2 Replace item-centric attention view-models with context/commit-centric ones.

## 2. Panel refactors

- [x] 2.1 Rebuild the Attention inspector around `Context` and `Commits` tabs.
- [x] 2.2 Rebuild Cycle detail to show input contexts, produced commits, and hook outcomes.
- [x] 2.3 Keep Chat conversation-first by removing raw technical attention output from the chat transcript.

## 3. Verification

- [x] 3.1 Add Storybook DOM coverage for the new Attention and Cycle panels.
- [x] 3.2 Run desktop/mobile browser walkthroughs for the greeting/reply workflow.
