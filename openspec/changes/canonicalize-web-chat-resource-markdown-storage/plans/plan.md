# Intent Document

## Current Round

- Round: 1
- Status: research-plan locked for breaking implementation
- Previous plan backup: none

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 找一下openspec specs，关于webui|studio，为了支持 图片、文件、评论，我引入了一种设计，就是使用脚注，来实现“资源引用”的支持。

> 不写代码，调查现有代码，评估该任务的完成情况和问题

> 关键问题是，我在web-chat-view中，看到的comment内容 ， 并没有通过 codemirror 渲染成一个 特殊的html-node。
> 更关键的是，我发出去的内容中，我的comment内容丢失了。
>
> 你检查一下shell-1这个房间的最后的聊天记录

> 不应该啊，我没设计过webChatCommentResources 这样的东西啊，数据库里面存储了？
> 我的本意是，直接使用markdown标准来存储，所以这种一种宽松的frontend-only的解析，后端数据库不该落地这种结构化信息

> 准确来说：DB 只存 message原始内容，是我们自己的web-chat-view自己定义使用markdown格式，并定义使用 markdown footnote来存储。
>
> 直接破坏性更新，矫正数据库结构，并修复所有相关工作。
> 使用openspec vision推进

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Support image, file, and comment resource references in WebUI/Studio through footnotes. | Resource references are a Markdown serialization law, not a backend structured metadata law. |
| 2 | User | Investigate existing code before coding. | Findings must be evidence-backed before implementation. |
| 3 | User | In `web-chat-view`, comment content is not rendered as a special CodeMirror HTML node, and sent comment content is lost. Check the last `shell-1` room message. | The bug must be verified against durable room truth and UI projection behavior. |
| 4 | User | User never designed `webChatCommentResources`; backend DB should not persist that frontend-only structure. | Any current persisted `webChatCommentResources` is wrong and must be removed. |
| 5 | User | DB stores only raw message content; `web-chat-view` defines Markdown format and uses Markdown footnotes for resource storage. Breaking update requested. | The fix is a platform-law correction, not a compatibility patch. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `~/.agenter/.message/rooms/room-message-0xa722ef80931d5b0ff44e39a96b8185d40b9138e6.db` | `shell-1` message `id=9` stores `content = [^Comment 1]` and stores the actual comment body in `metadata_json.webChatCommentResources`. | Confirms durable DB is currently polluted with frontend-shaped structured metadata and raw content is insufficient. |
| `packages/web-chat-view/example/src/lib/review-example.api.ts` | Send path posts `content: payload.text.trim()` and `metadata.webChatCommentResources`. | The frontend app-view introduced a second storage carrier outside Markdown content. |
| `packages/cli/src/trpc-server.ts` | Direct room endpoint accepts arbitrary `metadata` and passes it through to `sendGlobalRoomMessage`. | Backend currently persists the frontend metadata bag. |
| `packages/cli/test/trpc-server.test.ts` | Test explicitly expects `metadata.webChatCommentResources` to persist. | Existing BDD now protects the wrong law and must be inverted. |
| `packages/web-chat-view/src/resource-contract.ts` | Pure footnote definitions are parsed into a map, but comment resources are created only from `metadata.webChatCommentResources`. | The current parser cannot satisfy "DB stores only Markdown content". |
| `packages/app-server/src/session-runtime.ts` | Runtime message ingress and source reads use `message.content`, not metadata. | AI-visible source facts lose comment body unless it is in Markdown content. |
| `packages/web-chat-view/src/composer/chat-draft-editor.svelte` | Composer CodeMirror uses markdown/autocomplete but no resource-token widget decorations. | Draft visual projection is separate follow-up surface work unless required for the send/storage law. |
| `openspec/specs/web-chat-view-framework7-overlay-resource-law/spec.md` | Sent resources are supposed to be driven by source Markdown and resource definition lines. | Durable spec direction already supports Markdown as the resource source. |
| `packages/web-chat-view/SPEC.md` | Package SPEC currently says Markdown footnotes are an optional serialization carrier. | Long-term package law must be corrected to "Markdown footnotes are the storage carrier". |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | pending |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | pending |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | pending |
| Normal archive | Commit containing `openspec archive <change>` result | pending |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | pending |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/web-chat-view-framework7-overlay-resource-law/spec.md` | Source-Markdown-driven sent-resource projection; raw footnote definitions hidden from transcript. | Extend and harden into a storage law. |
| `openspec/specs/web-chat-view-framework7-component-system/spec.md` | Draft and sent states share one resource projection law; sent resources derive from source Markdown. | Extend. |
| `openspec/specs/web-chat-view-comment-resource-flow/spec.md` | Comment resources reopen into dedicated detail stage with stored comment body and anchor continuity. | Reinterpret "stored" as Markdown-stored, not metadata-stored. |
| `packages/web-chat-view/SPEC.md` | Resource law says footnotes are optional carrier. | Break: footnotes become the canonical storage carrier for WebChat resources. |
| `openspec/changes/fix-web-chat-view-message-comment-polish` | Prior work polished UI and persisted metadata-shaped comment resources. | Break where it contradicts Markdown storage; preserve UI affordances where compatible. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `资源引用` | A lightweight visible token in message body that points to image/file/comment resource details. | Resource reference. |
| `脚注` / `markdown footnote` | The canonical storage syntax inside `message.content`. | `[^Comment 1]` plus a `[^Comment 1]: ...` definition line. |
| `frontend-only的解析` | `web-chat-view` may parse Markdown into resource UI, but backend DB must not store frontend-specific structures. | Parser/projection belongs to frontend package. |
| `message原始内容` | The durable DB source of truth for a message row. | Raw Markdown content string. |
| `破坏性更新` | Remove wrong compatibility shape instead of preserving bad metadata. | Prefer migration and test inversion over adapter glue. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Current evidence is direct from DB/code/tests. | none |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should existing live `webChatCommentResources` rows be migrated automatically? | This rewrites durable message content and strips metadata. | Yes; user explicitly requested breaking DB structure correction. |
| Should Markdown footnote definitions encode comment anchor URI? | Comments need selected-text source continuity. | Yes; keep `[^Comment 1]: [comment body](msg://room/message#Lx)` as the current resource definition shape unless specs later define a richer markdown convention. |
| Should backend reject all message metadata? | Some metadata may be unrelated to WebChat resources, like client message ids. | Only reject/strip WebChat resource metadata from this path; keep platform metadata that has separate law. |

## Intent

### Surface Intent

`web-chat-view` should store image/file/comment resource references directly in raw Markdown message content using footnote syntax. Database rows should not contain `webChatCommentResources` or any equivalent frontend-only structured resource payload.

### Underlying Drive

The current implementation violates the "投影不等于本体" law. A UI projection object escaped into durable backend truth, while Runtime and AI-visible message ingestion still consume only `message.content`. The system now has two carriers, and the one humans expect is not the one AI consumes.

### Final Visible Effect

When an operator comments on a source line and sends the message:

- the stored room message content contains both the inline token and the footnote definition;
- the comment body is visible to AI/runtime because it is in `message.content`;
- `metadata_json` no longer contains `webChatCommentResources`;
- `web-chat-view` reconstructs the comment resource UI from Markdown alone;
- old polluted rows are converted into Markdown content and cleaned.

## Platform Diagnosis

- Current platform laws:
  - Message DB stores `content`, `metadata_json`, attachments, and payload.
  - Runtime message ingestion treats `message.content` as the source fact.
  - WebChat resource UI is supposed to derive sent resources from source Markdown.
- Does this fit as a regular atom: no.
- Does this require law upgrade: yes; resource references must be a Markdown storage law, not a WebChat metadata convention.
- Breaking update stance: required and user-approved.
- User confirmations still required: none for the main destructive direction; migration implementation should be transparent and reversible through git/test evidence.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator sees and edits normal chat prose. Resource tokens remain lightweight. Comment details still open from tokens/rails/shelves. But when the raw source or DB content is inspected, the whole resource reference is present as Markdown, not hidden in a metadata blob.

### Interface Shape

- Composer submit payload may still carry pending `commentResources` as frontend runtime state before send.
- The send boundary must serialize pending resources into Markdown `content` before the message reaches backend storage.
- Backend direct app-view room send must not persist `webChatCommentResources`.
- Resource UI extraction must work from Markdown content alone.

### Data Shape

- Durable truth: `chat_message.content`.
- Allowed durable platform sidecars: attachments and platform-owned metadata like client message id.
- Forbidden durable WebChat sidecar: `metadata.webChatCommentResources`.
- Projection: parsed `WebChatResourceReference[]` created at render time from Markdown content and attachments.

### Architecture Shape

- `web-chat-view` owns Markdown resource grammar.
- MessageSystem stores opaque raw Markdown content and does not understand WebChat resource payloads.
- Runtime consumes message content and therefore naturally sees footnote definitions.
- Migration/repair code may know the legacy key only to remove it and produce canonical Markdown; it must not preserve the legacy key as a live contract.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Existing row rewrite | It changes durable local DB content. | Approved by user request: "直接破坏性更新，矫正数据库结构". |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should image/file resource definitions also be parsed from Markdown without attachments metadata? | User named images/files/comments. | Yes for frontend source projection where enough Markdown data exists; DB may still store platform attachments as canonical uploaded asset facts. |
| Should live DB migration run automatically at daemon startup or as an explicit script? | Startup mutation can surprise, but user asked to correct DB structure. | Add a controlled repair path/test first; prefer startup-safe idempotent migration only if message DB already has migration hooks. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep `webChatCommentResources` and teach Runtime to read it. | It cements the wrong hidden metadata truth and violates the user's storage law. |
| Store both metadata and Markdown for compatibility. | It creates dual truth and guarantees drift. |
| Only change frontend rendering. | It leaves durable DB polluted and AI-visible content incomplete. |
| Backend understands full WebChat resource schema as first-class message metadata. | This makes a frontend Markdown grammar into a backend platform schema without need. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: 3
- Custom exit condition from intent: targeted tests prove `webChatCommentResources` no longer persists, pure Markdown footnotes reconstruct comment resources, Runtime message envelopes include comment body through `message.content`, and legacy polluted rows have a tested cleanup path.
