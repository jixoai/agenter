## Why

After the kernel shifts to context-plus-commit semantics, the UI must explain that model directly. The current Attention and Cycles panels still describe items, refs, and egress in the older architecture, so users cannot prove whether unresolved context debt still exists or whether a message hook actually delivered a reply.

## What Changes

- **BREAKING** redesign Attention and Cycles around context state, commit history, and commit hook outcomes.
- Make `Context` the default attention view and `Commits` the history/detail view.
- Show hook results directly on commits and cycles.
- Keep Chat conversation-first: only real channel messages render in Chat.
- Update selectors, stories, and browser walkthroughs to prove the new semantics on desktop and mobile.

## Capabilities

### New Capabilities
- `attention-context-proof-view`: inspect context state (`content`, `scoreMap`, `headCommitId`) and recent commits.
- `attention-commit-timeline`: inspect cycle-produced commits and their hook outcomes.

### Modified Capabilities
- `cycles-devtools-timeline`: cycles become commit-centric rather than item-ref-centric.
- `chat-surface-presentation`: Chat only displays channel messages produced by message-system.

## Impact

- Affected code: `packages/client-sdk`, `packages/webui/src/features/attention`, `packages/webui/src/features/process`, `packages/webui/src/features/chat`.
- Verification: Storybook DOM tests plus desktop/mobile browser walkthroughs for the greeting/session reproduction.
