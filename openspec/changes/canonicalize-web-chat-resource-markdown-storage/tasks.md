## 1. Alignment / Investigation

- [x] 1.1 Confirm the current `plans/plan.md` still reflects the code survey, `shell-1` DB evidence, existing OpenSpec survey, and user Q&A that approved the breaking update.
- [x] 1.2 Confirm the destructive cleanup assumption is already authorized by the user's "直接破坏性更新，矫正数据库结构" instruction, so no extra confirmation gate blocks implementation.
- [x] 1.3 Confirm each task checkbox is updated only by the agent that completed and verified that task in the current working context.

## 2. BDD Contract

- [ ] 2.1 Add or invert a room-send behavior test: Given WebChat sends comment resource data When the backend persists the message Then `content` contains the Markdown footnote definition and `metadata_json` does not contain `webChatCommentResources`.
- [ ] 2.2 Add a backend boundary test: Given a caller submits forbidden `webChat*Resources` metadata When a room message is written Then snapshot/page/transport-visible message metadata omits that key.
- [ ] 2.3 Add a WebChat resource parser test: Given pure Markdown content with a `[^Comment N]` token and definition When sent resources are resolved Then the comment resource opens from Markdown without metadata.
- [ ] 2.4 Add a WebChat send-path test: Given pending source-comment state When app-view builds the send payload Then it emits canonical Markdown content and no `webChatCommentResources` metadata.
- [ ] 2.5 Add a legacy cleanup test: Given a polluted row with inline token plus `metadata.webChatCommentResources` When repair runs twice Then the first run appends one canonical Markdown definition and strips metadata, and the second run is a no-op.
- [ ] 2.6 Add a runtime ingress regression check: Given repaired/pure Markdown room content When runtime reads room messages Then the comment body is available through `message.content`.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check canonicalize-web-chat-resource-markdown-storage --phase apply` before app-code work starts and commit ready OpenSpec artifacts.
- [ ] 3.2 Implement the WebChat Markdown serialization helper that converts pending image/file/video/comment resources into inline tokens plus footnote definition lines in raw `content`.
- [ ] 3.3 Update app-view/shared send paths to call the Markdown serializer and stop emitting `metadata.webChatCommentResources`.
- [ ] 3.4 Update sent-resource extraction so comment resources reconstruct from Markdown footnote definitions rather than `metadata.webChatCommentResources`.
- [ ] 3.5 Implement a typed backend metadata sanitizer that removes forbidden WebChat resource projection keys at the room write boundary without widening the metadata bag with `any`.
- [ ] 3.6 Implement an idempotent legacy repair path for existing room DB rows that converts `metadata.webChatCommentResources` into Markdown footnote definitions and removes the legacy metadata key.
- [ ] 3.7 Update long-lived package/root specs or implementation docs that still describe Markdown footnotes as optional rather than canonical storage for WebChat resources.
- [ ] 3.8 Add concise intent comments only at the critical effect points where hidden metadata is stripped or legacy rows are rewritten, explaining that `message.content` is the durable truth.
- [ ] 3.9 Update task checkboxes only after each current-context implementation and verification slice is complete, and commit matching task/code/BDD evidence.

## 4. Verification

- [ ] 4.1 Run the targeted backend/message tests that cover room send metadata stripping and legacy repair.
- [ ] 4.2 Run the targeted `@agenter/web-chat-view` tests that cover Markdown resource parsing and send serialization.
- [ ] 4.3 Run the runtime ingress regression check proving comment text reaches model-facing content through `message.content`.
- [ ] 4.4 Run `bun run openspec:vision -- validate canonicalize-web-chat-resource-markdown-storage`.
- [ ] 4.5 Run `bun run openspec:vision -- commit-check canonicalize-web-chat-resource-markdown-storage --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and tasks.
- [ ] 5.2 Generate `review/self-review.html` as structured command/test evidence for this backend/frontend contract change.
- [ ] 5.3 If self-review reopens OpenSpec artifacts or tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If review enters a real loop, run `bun run openspec:vision -- review-state canonicalize-web-chat-resource-markdown-storage` to persist iteration / recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff canonicalize-web-chat-resource-markdown-storage` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `bun run openspec:vision -- check canonicalize-web-chat-resource-markdown-storage` and decide whether to archive or return to `research-plan` with a backed-up plan revision.
