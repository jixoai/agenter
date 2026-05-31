# Vision-Driven Self Review

## Review State

- Change: `canonicalize-web-chat-resource-markdown-storage`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: targeted exit condition is satisfied; broader unrelated suite failures are recorded below.
- Next loop action: run `bun run openspec:vision -- check canonicalize-web-chat-resource-markdown-storage`, then decide archive versus operator review pause.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| DB stores raw message content as the durable WebChat resource carrier | `MessageDb.appendMessageDetailed` now sanitizes WebChat `*Resources` metadata before insert; `packages/message-system/src/message-metadata.ts` repairs legacy metadata into Markdown content. | aligned |
| App-view sends comment resources as Markdown footnotes, not metadata | `submitReviewMessage` serializes `payload.commentResources` through `serializeMessageSourceMarkdown`; `review-submit-markdown-contract.test.ts` proves no `metadata` field is emitted. | aligned |
| Sent comment resources reconstruct from Markdown alone | `resolveMessageResourceReferences` now maps comment footnote definitions directly to `WebChatResourceReference`; `comment-resource-contract.test.ts` proves legacy metadata is ignored. | aligned |
| Runtime/AI ingress sees the comment body through `message.content` | `session-runtime.attention-system.test.ts` now sends a Markdown comment footnote and asserts active attention detail contains `Check compact layout before shipping`. | aligned |
| Existing `shell-1` polluted row is corrected | Actual row `id=9` in `/Users/kzf/.agenter/.message/rooms/room-message-0xa722ef80931d5b0ff44e39a96b8185d40b9138e6.db` now has the comment footnote definition in `content` and `metadata_json = "{}"`. | aligned |

## Deviations From Intent

1. No route-level browser screenshot was produced because the core requested failure was storage/runtime contract, not a visual layout change.
2. Full `@agenter/web-chat-view` unit suite still has an unrelated pre-existing workspace assertion failure: `rootPackageJson.workspaces` does not contain `packages/*/*`.
3. Full `packages/cli/test/trpc-server.test.ts` still has unrelated failures in the multi-agenter shared-room setup and profile-service icon path; the targeted app-view room endpoint test passes.

## New Questions For User

1. None required for the approved breaking direction. Archive timing is the only process decision if the user wants this change landed immediately.

## Evidence

- HTML report: `review/self-review.html`
- Git commits reviewed:
  - `6a378c83 docs(spec): define canonical web chat resource markdown storage`
  - `7bfc6882 docs(spec): record web chat markdown apply entry`
  - `adb27a09 fix: canonicalize web chat resource markdown storage`
- Uncommitted paths at review start: none before self-review artifacts.
- Task checkboxes updated by this working context: 1.1-1.3, 2.1-2.6, 3.1-3.9, 4.1-4.4.

## Command Evidence

| Command | Result |
| ------- | ------ |
| `bun test packages/message-system/test/message-system.test.ts` | pass, 45 tests |
| `bun test packages/cli/test/trpc-server.test.ts -t "app-view room mode posts"` | pass |
| `bunx vitest run --config vitest.config.ts --project unit test/comment-resource-contract.test.ts test/message-source-serialization-contract.test.ts` in `packages/web-chat-view` | pass, 2 files / 7 tests |
| `bunx vitest run --config vitest.config.ts test/review-submit-markdown-contract.test.ts` in `packages/web-chat-view/example` | pass |
| `bun test packages/app-server/test/session-runtime.attention-system.test.ts -t "shared-room unread message"` | pass |
| `bun run --filter '@agenter/web-chat-view' typecheck` | pass, 0 errors / 0 warnings |
| `bun run openspec:vision -- validate canonicalize-web-chat-resource-markdown-storage` | pass |
| `git diff --check` | pass |
| `bunx vitest run --config vitest.config.ts --project unit` in `packages/web-chat-view` | fail on unrelated `packages/*/*` workspace assertion |
| `bun test packages/cli/test/trpc-server.test.ts` | fail on unrelated shared-room initialUsers error and profile-service icon 500/timeout |

## Exit Handling

- Normal exit path is available after `bun run openspec:vision -- check canonicalize-web-chat-resource-markdown-storage`.
- No handoff is required.
