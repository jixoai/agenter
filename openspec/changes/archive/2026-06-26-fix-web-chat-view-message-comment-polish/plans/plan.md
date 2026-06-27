# Intent Document

## Current Round

- Round: 6
- Status: Acceptance feedback loop reopened after user reported more Chatview modal surfaces still do not use official Framework7 styling and asked for a reusable best-practice encapsulation.
- Previous plan backup: None.

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

> 很好，我看到效果了。接下来我们需要做一些讨论、改进和修复：
> 1. [Image #1]
> 1.1. 为什么这里显示的是 Trusted bootstrap？不应该是发送者的名字吗？
> 1.2. 消息气泡中的DOM元素： `<div role="presentation" class="message-card message-card-with-actions svelte-945hza" part="message-bubble message-bubble-viewer">`，不论是气泡在左边还是在右边，都有一个样式
> ```
> @container (max-width: 34rem) {
>     .message-card-with-actions.svelte-945hza {
>         padding-inline-end: 1.12rem;
>     }
> }
> ```
> 这个样式的意义是什么？而且为什么不论气泡在左边还是在右边，都是 padding-right（因为不论气泡在左在右，都不会改变dir）
> 1.3. 头像没有正确绑定我们的内部的AuthSystem提供的头像(我们需要对头像组件进行统一）
>
> 2. [Image #2]
> 2.1. No commit body yet 这本身就意味着评论是空的，那么就不该有这条评论
> 2.2. 评论图标请使用 `<MessageSquareDot />` 这个图标（我还对`.comment-anchor-serial span`做了一些样式修改，你直接接受就好）
>
> 3. [Image #3]
> 3.1. 整个评论面板（不单单是这个编辑评论的地方），很多都偷懒只用了文字做按钮，没有用图标做按钮
> 3.2. 可以看到这里的textarea被截断了，我看了代码，核心是因为你配置了`.message-source-comment-editor-content.page-content`padding样式：`padding: 0.52rem max(0.72rem, env(safe-area-inset-right)) calc(0.86rem + env(safe-area-inset-bottom)) max(0.72rem, env(safe-area-inset-left));`从而导致Framework7默认的样式：`padding-top: calc(var(--f7-page-navbar-offset, 0px) + var(--f7-page-toolbar-top-offset, 0px) + var(--f7-page-subnavbar-offset, 0px) + var(--f7-page-searchbar-offset, 0px) + var(--f7-page-content-extra-padding-top, 0px));
>     padding-bottom: calc(var(--f7-page-toolbar-bottom-offset, 0px) + var(--f7-safe-area-bottom) + var(--f7-page-content-extra-padding-bottom, 0px));` 这两个样式都失效了
> > 还有大量的地方，你都做了类似的`env(safe-area-inset`，然而，这都和Framework7的很多样式都冲突了。想要彻底解决这个问题，除了依赖Framework7 的文档，我个人推荐的方案是基于源代码中使用`env(safe-area-inset-*)`的地方，使用agent-browser中去定位对应的元素，查询元素的CSS rules，看看是不是有默认的Framework7的样式，比如你用的是 margin:env(safe-area-inset-*) 那就查询 margin，如果你用的是padding，那么就查询padding，看是不是覆盖冲突了，如果覆盖冲突，那么就要好好想象，更好的覆盖方案是什么
>
>
> ---
>
> 仍然使用openspec vision推进（之前的如果有change，收尾并archive后再做新的开发）

## Round 2 User Acceptance Feedback

> 1. [Image #1] 出现了双重 page-content
> 2. [Image #2] 有图标就不要文字了
> 3. 评论如果为空，自动删除。或者应直接给一个删除按钮，在preview|edit 这组按钮的旁边放一个 icon-button，空内容直接删除，有内容就弹出确认框删除。但是空内容，我建议在保存到时候检测，自动删除

## Round 3 User Acceptance Feedback

> 1. 如果是空内容，点击保存按钮或者点击关闭按钮（或者是因为Model关闭触发的回调），都会触发删除动作，并关闭面板。目前你制作了保存按钮会删除而不关闭
> 2. 我发现很多Model Sheet和Framework7官方DEMO展示的Model Sheet的样式完全不一样，为什么不能用官方版本的风格？

## Round 4 User Acceptance Feedback

> 删除后，无法关闭的问题还是存在，终端报错：
> ```
> Uncaught TypeError: Cannot read properties of undefined (reading 'swipeToClose')
>     at HTMLDivElement.handleTouchStart (sheet-class.js:146:39)
>     at HTMLDivElement.handleEvent (dom7.esm.js:377:14)Understand this error
> 16:05:49.417 sheet-class.js:104 Uncaught TypeError: Cannot read properties of undefined (reading 'closeByBackdropClick')
>     at Framework7.handleClick (sheet-class.js:104:26)
>     at events-class.js:74:24
>     at Array.forEach (<anonymous>)
>     at events-class.js:73:18
>     at Array.forEach (<anonymous>)
>     at Framework7.emit (events-class.js:67:17)
>     at emitAppTouchEvent (touch.js:358:9)
>     at HTMLDocument.appClick (touch.js:364:5)
> ```

## Round 5 User Acceptance Feedback

> [Image #1] 为什么这里的评论会在发送按钮的旁边，这属于资源，应该在资源栏啊，我记得是在消息框的上方一条，可以放图片文件评论等资源

## Round 6 User Acceptance Feedback

> 目前这个 Chatview 还有很多 model 用的都不是Framework7 官方提供的样式。跟之前让你修复的一样，请你形成最佳实践，通过一种可靠的封装的方式去进行修复样式

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Previous app-view embedding effect is visible and accepted as the baseline to continue from. | Do not reopen the iframe/app-view boundary unless this change proves a new shell law issue. |
| 2 | User | `Trusted bootstrap` is shown where sender name is expected. | Fix identity presentation projection so bootstrap/admin access labels do not leak as message sender display when a canonical sender/contact exists. |
| 3 | User | Message card reserves `padding-inline-end` on compact viewport regardless of left/right bubble position. | Rework row action spacing so direction/ownership is explicit and not a blanket padding-right-like reservation. |
| 4 | User | Avatar is not correctly bound to internal AuthSystem avatar; avatar component should be unified. | App-view room mode must receive/calculate canonical contact labels and avatar URLs from the same identity source used by Studio/AuthSystem. |
| 5 | User | Empty comment body means the comment is empty, so that comment should not exist. | Do not render placeholder comment records as visible comments; empty drafts should remain drafts, not resources. |
| 6 | User | Comment icon must use `<MessageSquareDot />`; user's `.comment-anchor-serial span` style tweak should be accepted. | Replace comment icon family without reverting user local style changes. |
| 7 | User | Whole comment panel uses text-only buttons in many places instead of icon buttons. | Upgrade comment/resource action controls to semantic icon controls with accessible labels. |
| 8 | User | Textarea is clipped because `.message-source-comment-editor-content.page-content` overwrites Framework7 PageContent padding. | Preserve Framework7 PageContent padding ownership; move custom spacing to Framework7 variables or inner shells. |
| 9 | User | Other `env(safe-area-inset-*)` usage may conflict with Framework7 defaults; use agent-browser to inspect actual CSS rules. | Real browser CSS rule evidence is part of the required investigation and self-review, not optional visual polish. |
| 10 | User | Continue using OpenSpec vision; archive previous change first if it exists. | Previous iframe/app-view change has already been archived in `1c73ff75`; this change starts fresh. |
| 11 | User | Source popup shows nested `.page-content` wrappers. | Any Framework7 `Page` that manually renders `PageContent` must set `pageContent={false}` instead of accepting the default wrapper. |
| 12 | User | Source toolbar actions show both icon and text. | Icon-bearing dense toolbar actions should be icon-only visually, with accessible labels/titles carrying text. |
| 13 | User | Empty comments should auto-delete, preferably on save detection. | Saving an empty comment edit should remove the draft/comment resource instead of disabling save or retaining an empty anchor/card. |
| 14 | User | Empty comment save, close button, and Sheet/Modal close callback should all trigger delete and close the panel. | Empty comment finalization must be one lifecycle action shared by Save, Cancel/Close, and Framework7 `onSheetClosed`. |
| 15 | User | Many Modal Sheet surfaces do not look like Framework7 official demo sheets. | Treat Sheet styling as a framework-law issue: use official `Sheet -> Toolbar -> PageContent` topology and avoid repainting Sheet/Toolbar chrome as custom glass panels. |
| 16 | User | Deleting an empty comment still leaves a non-closing Sheet and Framework7 throws `sheet.params` undefined errors from `swipeToClose` and `closeByBackdropClick` handlers. | Do not destroy a live Framework7 Sheet by removing the Svelte component while it is open or closing; first drive `opened=false`, then release the retained Sheet state after `onSheetClosed`. |
| 17 | User | Chatview still has many modal surfaces whose styling is not provided by official Framework7; fix it through best practice and reliable encapsulation rather than another local patch. | Promote Framework7 modal/chrome ownership into a reusable Web Chat law: business code must enter Sheets, Popups, Messagebar sheets, and Actions through package-owned wrappers/helpers that preserve official chrome and limit custom CSS to inner content. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `openspec/changes/archive/2026-05-30-fix-studio-web-chat-view-embedding-style` | Previous change established app-view iframe as the app boundary and archived the work. | This change should fix app-view internals, not Studio iframe outer CSS. |
| `packages/message-system/src/message-control-plane.ts` | `TRUSTED_BOOTSTRAP_LABEL = "Trusted bootstrap"` and `resolveAuthorizedSender(...)` can use grant label as `from` after participant lookup. | This explains why a bootstrap/admin grant label can leak into sender display. |
| `packages/message-system/src/types.ts` | `MessageParticipant` has `id` and `label`, but no avatar/icon field. | Avatar cannot be solved by participant records alone; app-view needs a presentation directory/API projection. |
| `packages/web-chat-view/example/src/lib/review-example.api.ts` | Room-mode `fetchReviewChannel` calls `/trpc/message.globalSnapshot` and builds `actorDirectory` only from viewer profile, participants, and seat states. | App-view room mode currently lacks Studio/AuthSystem profile icon resolver. |
| `apps/studio/src/lib/features/messages/message-room-route.svelte` | Studio has `describeActor(...)`, `buildActorDirectory(...)`, and `controller.runtimeStore.profileIconUrl(...)`. | Studio already has canonical avatar knowledge, but iframe app-view does not receive it through the snapshot contract. |
| `packages/web-chat-view/src/message-row.svelte` | `.message-card-with-actions` adds `padding-inline-end`, including compact override `1.12rem`; `.bubble-actions` is always `inset-inline-end`. | The current action affordance reserves the same logical end side regardless of message ownership; this is the user's padding concern. |
| `packages/web-chat-view/src/comment-anchor-badge.svelte` | Component still imports `MessageSquareMore`, displays `No comment body yet.`, and has user-modified `.comment-anchor-serial span` style. | Replace icon/empty behavior while preserving user's style change. |
| `packages/web-chat-view/src/comment-inspector.svelte` | Inspector imports `MessageSquareMore`, displays `No comment body yet.`, and uses text `Cancel`/`Save` links in the edit sheet. | Comment panel needs icon/action cleanup beyond only the source editor. |
| `packages/web-chat-view/src/message-source-popup.svelte` | Source popup toolbar uses text-only `Actions`, `Comment`, `Cancel`, `Save`; edit `PageContent` overwrites whole padding with `env(safe-area-inset-*)`. | This is the concrete clipping and action-control target. |
| `packages/web-chat-view/node_modules/framework7/components/page/page.less` | `.page-content` owns `padding-top` and `padding-bottom` via `--f7-page-navbar-offset`, toolbar offsets, searchbar offset, safe-area bottom, and extra padding variables. | Whole-property `padding` on `.page-content` destroys Framework7 offset law. |
| `packages/web-chat-view/node_modules/framework7/components/toolbar/toolbar.less` | Toolbar sibling selectors set `--f7-page-toolbar-top-offset` / `--f7-page-toolbar-bottom-offset`. | The sheet editor should let Framework7 wire toolbar offset instead of hardcoding safe-area math. |
| `packages/web-chat-view/node_modules/framework7-svelte/components/sheet.svelte` | Framework7 Svelte moves direct child `.navbar`, `.toolbar`, `.tabbar`, and `.searchbar` nodes from `.sheet-modal-inner` to fixed sheet chrome before creating the sheet instance. | The official Sheet topology requires toolbar/searchbar chrome to be direct Sheet children; nested or over-custom wrappers break the visual law. |
| `packages/web-chat-view/node_modules/framework7/components/sheet/sheet.less` | `.sheet-modal` owns background, radius, overflow, transition, and push/backdrop behavior through Framework7 variables. | Web Chat should not repaint sheet modal chrome with ad hoc background/backdrop filters when the goal is official Framework7 style. |
| `packages/web-chat-view/node_modules/framework7-svelte/components/sheet.svelte` | `onDestroy` calls `f7Sheet.destroy()`, while the Framework7 sheet class owns touch/click handlers bound to the sheet/app lifecycle. | If Web Chat conditionally unmounts a Sheet while it is open, the instance can be destroyed before Framework7 has closed and unbound handlers. |
| `packages/web-chat-view/node_modules/framework7/components/sheet/sheet-class.js` | `handleTouchStart` reads `sheet.params.swipeToClose`; `handleClick` reads `sheet.params.closeByBackdropClick`. | The reported undefined `params` errors are consistent with a destroyed sheet instance whose event handlers are still reachable. |
| `packages/web-chat-view/src/default-composer.svelte` | Composer tool tray uses `MessagebarSheet`, but the component CSS directly repositions and repaints `.composer-tool-sheet.messagebar-sheet` with absolute positioning, custom background, blur, radius, shadow, and `env(safe-area-inset-bottom)` padding. Framework7 Svelte's `Messagebar` only hoists a sheet found under `.toolbar-inner` during messagebar initialization or when its internal update path runs. | This violates the same Framework7 chrome-ownership law as the earlier Sheet issue; tool tray should use Framework7 `MessagebarSheet` / `MessagebarSheetItem` through a wrapper, stay mounted for Framework7 initialization, and style only inner item content or Framework7 variables. |
| `packages/web-chat-view/src/resource-preview-shell.svelte` | Shared preview popup already uses `Popup -> View -> Page -> Navbar -> PageContent`, but still repaints `.resource-preview-shell-popup`, nav slots, and bottom toolbar chrome with custom blur/background/safe-area padding. | The shell topology is correct, but its modal chrome is still not official; clean it without breaking the unified preview family. |
| `packages/web-chat-view/src/message-actions-menu.svelte`, `message-actions-context-menu.svelte`, `selection-action-surface.svelte` | Each component repeats its own Framework7 `actions.create(...)` types and fallback custom popover/menu CSS with blurred self-drawn surfaces. | Contextual actions should be one package-owned Framework7 Actions adapter; business components should not each reinvent action modal creation and fallback chrome. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending this round; app code not started. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending after BDD + implementation. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending. |
| Normal archive | Commit containing `openspec archive <change>` result | Pending after user-visible review. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/changes/archive/2026-05-30-fix-studio-web-chat-view-embedding-style/specs/web-chat-view-embedded-style/spec.md` | App-view partial room mode is the iframe/app boundary; app-view owns Framework7 shell and app styles. | Reuse. This change fixes the app-view internals inside that boundary. |
| `openspec/changes/archive/2026-05-30-fix-studio-web-chat-view-embedding-style/specs/message-system-surface/spec.md` | Studio loads Web Chat app-view through iframe; Studio should keep superadmin controls outside. | Reuse. Do not solve these issues by Studio outer CSS. |
| `openspec/specs/web-chat-view/spec.md` | Shared package owns transcript/composer and canonical avatar rendering. | Extend with sender/contact presentation and comment resource rules. |
| `openspec/specs/web-chat-view-framework7-visual-law/spec.md` | Framework7 topology is the visual law for chat surfaces. | Extend with PageContent padding ownership and safe-area override discipline. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `Trusted bootstrap` | A grant/bootstrap label leaking into sender presentation. | It is access provenance, not the visible author name. |
| `不应该是发送者的名字吗` | Sender display must come from canonical sender/contact presentation. | Show who wrote it, not which admin token allowed it. |
| `头像组件进行统一` | Avatar display should use one identity presentation pipeline. | The same contact/profile should produce the same avatar in Studio and app-view. |
| `空的，那么就不该有这条评论` | Empty comment body is absence of a comment resource. | No placeholder comment cards for empty body. |
| `偷懒只用了文字做按钮` | Text-only action links are not acceptable for dense mobile comment panels. | Use icon affordances with labels/ARIA, not bare text links. |
| `Framework7默认的样式都失效了` | Custom CSS overwrote a framework-owned layout contract. | Preserve PageContent offsets and use the intended extension variables. |
| `好好想象，更好的覆盖方案是什么` | Do not mechanically replace `env(...)`; reason about ownership and CSS cascade. | First inspect rules, then change the owner boundary. |
| `双重 page-content` | A Framework7 `Page` default wrapper is nesting around a hand-written `PageContent`. | If we own the `PageContent`, disable the automatic one on `Page`. |
| `有图标就不要文字了` | Dense toolbar affordances should be icon-only visually. | Keep text only in `aria-label` / `title`, not in the rendered toolbar row. |
| `评论如果为空，自动删除` | Empty body means the comment resource should be removed at save time. | Empty save deletes the local anchor or pending resource without confirmation. |
| `点击保存按钮或者点击关闭按钮（或者是因为Model关闭触发的回调）` | Empty-body delete must be triggered by every way the edit lifecycle ends. | Save, close/cancel, and Framework7 sheet-close callbacks should call the same finalizer. |
| `官方版本的风格` | Framework7 Sheet should look like its official component family, not a host-local glass panel. | Preserve F7 Sheet/Toolbar/PageContent ownership and only style inner content for app details. |
| `删除后，无法关闭` | The visual close state and framework lifecycle are out of sync. | Business deletion must not directly remove the Sheet component before Framework7 receives `opened=false` and emits closed. |
| `swipeToClose / closeByBackdropClick undefined` | Framework7 handlers are reading a destroyed Sheet instance. | Retain the Svelte Sheet component through the close lifecycle and disable unused backdrop-click handler registration for no-backdrop sheets. |
| `评论会在发送按钮的旁边` | Dynamic comment resource insertion is rendering in the toolbar action row. | Pending resources must be owned by `messagebar-area` as the attachment/resource rail above the draft, not by the send button toolbar pane. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None yet | Browser CSS-rule evidence will be captured under `review/evidence/`. | Keep as self-review evidence. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should `Trusted bootstrap` ever be visible as a message sender when a bootstrap/admin sends without specifying a sender? | If there is no real sender, the system needs an honest fallback. | It may remain as a low-level fallback only when no canonical sender/contact can be resolved; normal app-view sends must include `senderContactId`. |
| Should app-view fetch avatar presentation from Studio or from daemon/backend? | Iframe should not depend on Studio stores. | Backend/snapshot presentation should be upgraded so app-view remains self-sufficient. |
| Should all safe-area `env(...)` usage be removed now? | Some uses may be correct on non-Framework7 inner shells. | This change fixes proven Framework7 PageContent/Toolbar conflicts and records remaining audit items if any are lower-risk. |

## Intent

### Surface Intent

Web Chat app-view should show correct sender names and avatars, keep message action affordances visually sane on both left and right bubbles, and make comment resources feel like a real Framework7 mobile surface instead of a partially hand-written overlay. Empty comments should disappear rather than advertising placeholder text. Comment controls should use the requested comment icon and semantic icon buttons. Textareas in comment sheets must not be clipped by custom safe-area padding.

### Underlying Drive

The issue is a boundary-law problem plus leaf UI debt:

- Identity projection must be canonical. Access-token provenance such as `Trusted bootstrap` is not the message author identity.
- App-view is self-contained. It should receive identity presentation through backend/app-view contracts, not by reaching into Studio stores through the iframe.
- Framework7 owns `PageContent` layout offsets. Web Chat can add spacing, but it must do so through Framework7 variables or inner content shells, not by overwriting `.page-content` padding.
- Framework7 owns `Sheet` and `Toolbar` chrome. Web Chat can provide title/action content and inner body spacing, but should not repaint Sheet/Toolbar backgrounds, auto heights, or safe-area math when the app intent is the official Framework7 sheet style.
- Framework7 owns modal chrome across the whole temporary-view family, not only comment edit Sheets. Web Chat can adapt action data, popup page content, and messagebar tool items, but business components should not repaint `.popup`, `.messagebar-sheet`, `.actions-modal`, `.toolbar`, or `.sheet-modal` directly.
- Comment resources should be real resources. Empty drafts are not resources.

### Final Visible Effect

When the operator opens a Studio room embedded app-view:

- message rows show the human sender/contact name and the expected profile/avatar image when AuthSystem/backend presentation can resolve it;
- bootstrap/admin labels do not appear as normal sender names unless there is truly no sender identity;
- bubble action affordances do not add unexplained right-side padding to every compact message card;
- comment anchors use `MessageSquareDot`, preserve the user's serial-number styling, and never show `No comment body yet`;
- comment/source panels use icon-first actions with accessible text and no bare text-only shortcuts as the primary action UI;
- comment edit textareas are not clipped because Framework7 `PageContent` offset variables remain active;
- browser evidence shows the relevant CSS rules before/after for the PageContent padding conflict.
- source popup and shared preview popup do not nest Framework7 `.page-content` wrappers;
- source-line toolbar actions show only icons while keeping accessible labels/titles;
- saving an empty comment edit removes the local anchor or pending comment resource instead of leaving an empty comment artifact.
- empty comment save, close/cancel, outside lifecycle close, and Framework7 `onSheetClosed` all delete the empty artifact and leave the editor panel closed.
- comment edit sheets use Framework7's official Sheet chrome style by default instead of host-local translucent toolbar/sheet repainting.
- messagebar tool sheets, resource preview popups/toolbars, and contextual action surfaces use reusable Framework7-owned wrappers/helpers instead of direct ad hoc modal chrome CSS.

## Platform Diagnosis

- Current platform laws: Studio owns outer operator chrome; app-view owns chat app UI; message-system stores room/message facts; AuthSystem/profile runtime owns canonical profile avatar facts; Framework7 owns Page/View/PageContent/Toolbar/Sheet layout offsets and chrome.
- Does this fit as a regular atom: partly. Comment icon/action polish is a regular UI atom.
- Does this require law upgrade: yes. Sender/avatar presentation and PageContent safe-area handling are platform-law fixes because they cross app-view/backend and framework-shell boundaries.
- Breaking update stance: no durable data migration is needed; API shape can be extended. Do not preserve `No comment body yet` as compatibility because it is a wrong visible state.
- User confirmations still required: none before implementation. If backend cannot resolve AuthSystem avatar without a larger endpoint, implement the narrowest self-contained projection and record the remaining gap.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator reads a room. Sender names look like people/contacts, not grants. Avatars match the same profile imagery Studio uses. A message row may expose a small action button, but the bubble itself does not appear padded on the wrong side. When the operator opens message source, comment anchors are compact and visually identifiable as comments. If the operator has not typed a comment body, no comment resource is rendered. When editing a comment, toolbar buttons are compact icon actions and the textarea sits below the toolbar without being cut off.

### Interface Shape

- App-view room snapshot needs an actor/contact presentation directory that includes `actorId`, `label`, `kind`, and `iconUrl` when available.
- Web Chat message rows resolve sender presentation from `senderContactId` first, then display `from` only as fallback.
- Comment resource components accept only non-empty comment bodies for visible comment detail.
- Framework7 edit sheets keep `Toolbar` and `PageContent` as siblings and use `--f7-page-content-extra-padding-*` or inner shell padding for custom spacing.
- Empty comment edit termination is one finalizer: if the trimmed draft is empty, delete the local comment artifact and close the owning panel; if non-empty, save or cancel according to the explicit action.
- Temporary action menus are created through one Framework7 Actions adapter that owns `convertToPopover`, target anchoring, close lifecycle, and non-runtime test fallback. Leaf components only provide action data.
- Messagebar tool tray is created through one composer tool-sheet wrapper that stays mounted inside `Messagebar` and uses Framework7 `MessagebarSheet` / `MessagebarSheetItem`; custom app style belongs inside each item, not on the sheet chrome.

### Data Shape

- Durable facts: message `senderContactId`, message `from`, channel participants/seats, auth/profile records, comment resource body.
- Projection: visible sender label/avatar, comment anchor icon, action layout, PageContent spacing.
- Forbidden confusion: grant label is not author identity; empty comment text is not a comment body; safe-area CSS variables are not a replacement for Framework7 offset ownership.

### Architecture Shape

- Message-system may continue storing `from`, but app-view should prefer canonical actor presentation by `senderContactId`.
- App-view should remain iframe self-sufficient: no Studio store imports, no event bridge for identity, no DOM reach-through.
- Web Chat should expose reusable Svelte components with package-owned CSS, but Framework7 framework primitives remain the shell owner.
- Comment UI fixes stay inside `packages/web-chat-view`, not in Studio route CSS.
- Framework7 Sheet visuals should come from official Sheet/Toolbar defaults; Web Chat should avoid custom translucent sheet backgrounds unless a future design law explicitly authorizes a different app family.
- Framework7 Sheet lifecycle must stay framework-owned. Web Chat may delete comment data immediately, but it must retain the Sheet component until the Framework7 close lifecycle reaches `onSheetClosed`.
- Framework7 Actions visuals should come from official `Actions` / popover conversion; Web Chat may centralize action data mapping, but individual message/source components should not own separate modal factories or blurred fallback panels.
- Framework7 Messagebar sheet visuals should come from official `MessagebarSheet` and Framework7 variables; Web Chat may choose compact height through variables, but should not conditionally mount the sheet after initialization, absolutely position it, or repaint the sheet chrome.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Remove `Trusted bootstrap` entirely from low-level debug surfaces | It may still be useful as access provenance in admin/debug views. | Do not remove the constant; prevent it from leaking as normal sender presentation. |
| Full safe-area cleanup across every `env(...)` use | Some uses are legitimate inner-shell layout. | Fix proven PageContent/Toolbar conflicts now; report remaining candidates in self-review. |

## Intent-Driven Plan

- [ ] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Capture browser CSS-rule evidence for Framework7 PageContent padding.
- [ ] 5. Implement identity/avatar projection, message action spacing, comment resource, and safe-area fixes.
- [ ] 6. Run BDD/typecheck/visual verification.
- [ ] 7. Self-review against intent and decide whether to loop.
- [ ] 8. Round 2: fix nested PageContent, icon-only source toolbar actions, and empty-comment save deletion.
- [ ] 9. Round 3: unify empty-comment finalization across save/close/Sheet callbacks and realign comment edit Sheet chrome with official Framework7 style.
- [ ] 10. Round 4: retain comment edit Sheets through the Framework7 close lifecycle so empty deletion cannot destroy live Sheet instances or leave stale swipe/backdrop handlers.
- [ ] 11. Round 6: encapsulate remaining Chatview temporary-view surfaces behind Framework7 modal helpers and remove direct modal chrome repainting.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Can current daemon snapshot already expose all AuthSystem profile icons needed by app-view? | If not, avatar unification may need a backend presentation endpoint. | Add/extend the minimal snapshot/app-view projection needed for current room mode. |
| Should message action affordance be hidden until hover/focus on compact mobile? | Hover is unreliable on touch, but permanent padding is visually wrong. | Keep an icon affordance available without reserving wrong-side bubble padding; use overlay or ownership-aware placement. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Patch Studio iframe outer CSS | The visible defects are inside app-view/Web Chat and Framework7 ownership; outer CSS would repeat the previous wrong boundary. |
| Keep `No comment body yet` as an empty-state card | User explicitly says empty body means there is no comment. |
| Replace Framework7 `PageContent` with a div to avoid padding conflicts | That discards the framework law instead of using it correctly. |
| Pass Studio runtimeStore through iframe event bridge for avatars | The app-view already connects to backend; backend/app-view contract should be the single source. |
| Fix the Sheet crash by disabling all Framework7 gestures globally | That hides the symptom but keeps the lifecycle bug. Gesture/backdrop parameters can be tightened per sheet, but the real fix is to stop destroying a live Sheet component before it closes. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2
- Custom exit condition from intent: OpenSpec validate/check pass; BDD covers identity, empty comments, requested icons, PageContent padding preservation, and action spacing; browser evidence includes before/after CSS-rule proof for the Framework7 padding conflict; self-review lists deviations and remaining future tasks.
