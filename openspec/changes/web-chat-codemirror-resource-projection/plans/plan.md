# Intent Document

## Current Round

- Round: 4
- Status: layered SVG consistency rework for resource icon projection
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

> 前端相关的配套做了吗？输入框使用codemirror writable，消息气泡使用codemirror readonly

> 用大白话、有画面感地解释一下你接下来要做的内容

> 开始用openspec推进，并用走查检查截图，确定符合预期后，最后让我走查。

> 我看到效果了，我提一些意见：
> 1. 视觉上`[^Comment 1]`应该渲染成一个 commit-icon-with-No 的图标，文件也同理。
>   我们应该统一封装一种 icon-with-No 的图标。
>   评论的基础图标就是 `<MessageSquareDot />` ，No 几乎居中（我有手写过一些样式，你可以参考）
>   图标的基础图标就是 `<File />`， No 居中，最好是两行文字，第一行是通过scale缩放的文件后缀；第二行是No
>   图片的基础图标就是 `<Image />`，No 通过角标的方式展示
>   完成这三个组件，行程三个动态图标，No只支持1~9，超出就显示成`*`字符就好
>   把这个动态图标，作为基础组件，彻底重构到相关的地方
> 2. message-markdown-resource-bar 这个元素的样式绝对有问题，等动态图标做好，这个bar的样式需要好好优化一下，它现在最大的问题是控制不好子元素的宽高以及自己的滚动条。本来不应该出现滚动条，结果横竖都出现了 [Image #1]

> 我看到你封装的组件了，效果挺不错，但是需要几点改进，并且我需要你给我提供不同颜色的、不同背景底色的，让我看看你的通用性如何。
> 1. image这个图标，本身图标的颜色好像是灰色，字体是黑色，这个应该是同一个颜色
> 2. 改进一些File这个图标，把文件后缀做到右下角去作为角标，No居中
> 3. 字体尺寸不要只用 font-size 控制，要用fontsize-1rem + scale，因为font-size会被了浏览器的最小字体大小限制

> 我看到效果了，不过会有一些一致性的问题。我建议，可以统一使用svg来绘制内部，也就是说最终是两个svg叠在一起，底层是icon图层，上层是info图层。这样行为会更加一致

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Frontend support must include a writable CodeMirror input and readonly CodeMirror message bubbles. | This change must verify and harden both editor modes, not only backend Markdown storage. |
| 2 | User | Explain the next work in plain language with a concrete picture. | Plan must preserve the "same Markdown base, two CodeMirror projection windows" mental model. |
| 3 | User | Use OpenSpec, inspect screenshots, confirm expected behavior, then let the user walk through. | Completion requires OpenSpec artifacts, automated/targeted verification, browser screenshot evidence, and a final user walkthrough URL/path. |
| 4 | User | Inline resource tokens should render as dynamic icon-with-No widgets, and the resource bar must stop producing uncontrolled scrollbars. | The shared projection atom must become visual-icon first; resource bar layout must be fixed-size and no-scrollbar by default. |
| 5 | User | The icon atom is directionally correct, but image ink must be unified, file extension must move to a bottom-right badge, text sizing must use `1rem + scale`, and the demo must show color/background generality. | The atom needs CSS-variable-driven theming and browser-min-font-safe text scaling before final visual acceptance. |
| 6 | User | The icon atom still has consistency problems; draw the internals as two overlaid SVG layers: a base icon layer and an info layer. | Replace mixed SVG + HTML overlay internals with a shared two-layer SVG drawing law while keeping the same public atom API. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `openspec/specs/web-chat-view/spec.md` | WebChat resources now serialize into raw Markdown footnotes before room send and reconstruct from Markdown after reload. | The storage law is already corrected; this change must not reintroduce backend sidecars. |
| `openspec/specs/web-chat-view-comment-resource-flow/spec.md` | Sent comment resources reopen from Markdown footnote definitions in `message.content`. | The readonly bubble projection must remain the sent-message truth path. |
| `openspec/specs/web-chat-view-framework7-overlay-resource-law/spec.md` | Sent resource footnote definitions collapse into in-bubble resource bars and inline tokens. | Existing readonly projection law can be extended into shared CodeMirror projection law. |
| `packages/web-chat-view/src/composer/chat-draft-editor.svelte` | Composer creates writable CodeMirror with Markdown/autocomplete, but does not run resource-token widget decorations. | The input surface is writable but lacks the same resource-node visual projection expected by the user. |
| `packages/web-chat-view/src/components/message-markdown-content.svelte` | Message bubbles create readonly CodeMirror with `EditorState.readOnly` and `EditorView.editable(false)`, then load `messageMarkdownPreview`. | Bubble readonly behavior is implemented and should be preserved. |
| `packages/web-chat-view/src/components/message-markdown-preview.ts` | Readonly projection hides resource definition lines and renders inline resource token/resource bar widgets. | The current plugin is too readonly-specific to drop unchanged into the composer. |
| `packages/web-chat-view/src/components/message-markdown-preview-widgets.ts` | Resource token and bar widgets are CodeMirror widget types backed by Svelte components. | These widgets should become reusable projection atoms, not stay tied to the bubble-only plugin. |
| `packages/web-chat-view/src/default-composer.svelte` | Pending image/file/comment resources live in the Messagebar resource rail and feed completion/resource references. | The writable editor can receive the same resource reference list without inventing another state source. |
| `packages/web-chat-view/src/storybook/chat-composer-stage-harness.svelte` | Existing composer story is a static visual mock, not the live composer CodeMirror. | Screenshot walkthrough must target real components, not a static approximation. |
| `packages/web-chat-view/vitest.config.ts` | Storybook tests run in real Chromium through Vitest browser. | CodeMirror writable behavior should be covered by Storybook DOM/browser tests, not jsdom-only tests. |
| `packages/web-chat-view/src/resource-card.svelte` | Resource cards currently hand-roll image/file/comment icon overlays. | These duplicated visuals should move behind one icon-with-number atom. |
| `packages/web-chat-view/src/components/message-markdown-resource-token.svelte` | Inline tokens currently render raw bracket text. | Replace text-first projection with the same icon-with-number atom while preserving accessible label/title and source Markdown truth. |
| `packages/web-chat-view/src/components/message-markdown-resource-bar.svelte` | The bar uses auto overflow and thin scrollbars. | Rework it as a fixed-height wrap-capable resource icon strip with no default scrollbar. |
| `packages/web-chat-view/src/components/resource-icon-with-number.svelte` | Round 2 centralizes icon drawing but still uses kind-specific hardcoded colors and `font-size: calc(...)`. | Upgrade to CSS variables and `font-size: 1rem` plus transform scale for small glyphs. |
| `packages/web-chat-view/src/storybook/chat-resource-projection-harness.svelte` | The walkthrough route shows core icon projection but not multiple ink/surface combinations. | Add a compact color/background matrix so the same atom is visibly generic. |
| `packages/web-chat-view/src/components/resource-icon-with-number.svelte` | Round 3 still mixes lucide SVG base icons with HTML span overlays for number and extension badges. | Refactor internals to two stacked SVG layers so base icon and info marks share one coordinate system. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | pending |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | pending |
| Self-review updates | Commit containing review output and screenshot evidence before archive or user walkthrough | pending |
| Normal archive | Commit containing archive result after user acceptance | pending |
| Abnormal handoff | Commit containing handoff evidence before returning on blocker | not needed yet |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/changes/archive/2026-05-31-canonicalize-web-chat-resource-markdown-storage` | DB stores raw Markdown; WebChat resource metadata sidecars are forbidden. | Reuse. This change adds frontend projection only. |
| `openspec/specs/web-chat-view/spec.md` | Markdown footnotes are canonical resource storage and sent messages reconstruct from raw content. | Extend with writable/readonly CodeMirror projection parity. |
| `openspec/specs/web-chat-view-framework7-overlay-resource-law/spec.md` | Readonly bubbles hide footnote definitions and render resource token/bar widgets. | Extend with shared widget atoms and composer-safe projection rules. |
| `openspec/specs/web-chat-view-comment-resource-flow/spec.md` | Comment resource continuity comes from Markdown content after send. | Reuse. Draft comments remain pending frontend state until serialized. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `前端相关的配套` | The visible editor/rendering surfaces must match the storage law. | UI projection must be fixed, not only DB storage. |
| `输入框使用codemirror writable` | Composer is an editable Markdown surface with resource-aware visual affordances. | Workbench window over the same Markdown base. |
| `消息气泡使用codemirror readonly` | Sent message bubble is a non-editable Markdown projection with resource nodes. | Display window over the same Markdown base. |
| `走查检查截图` | The agent must visually inspect and capture evidence before returning. | Browser screenshot evidence is required. |
| `最后让我走查` | Do not declare final acceptance alone. | Provide a live URL or screenshot paths for user acceptance. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| pending | Need a live composer story using real `DefaultComposer` and `MessageMarkdownContent`. | Keep as Storybook DOM contract if small and useful. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should the composer hide footnote definition lines while editing? | Hiding source in a writable editor can surprise cursor/copy behavior. | No. Composer should widgetize lightweight resource tokens but keep user-authored Markdown editable. Definitions are appended at submit time and readonly bubbles hide them. |
| Should resource chips inside the composer be atomic/non-editable? | Atomic widgets can make deletion intuitive but can interfere with text editing. | Use lightweight inline token widgets around existing text, keep the underlying token text as the editable truth. |

## Intent

### Surface Intent

The operator should see one coherent Markdown resource experience: while writing, the input is a writable CodeMirror editor that recognizes resource references as resource affordances; after sending, the message bubble is a readonly CodeMirror editor that hides footnote plumbing and shows clickable resource nodes.

### Underlying Drive

The previous change fixed the durable "bottom layer": DB content is Markdown. This change fixes the "front glass": the same Markdown base must be projected consistently in the composer and in the transcript. Projection must stay explicitly a view layer and must never become another durable data carrier.

### Final Visible Effect

In the composer, a comment/image/file reference looks like a compact icon with a visible resource number instead of dead bracket text, while the user can still type, move the cursor, and submit normally. In the transcript bubble, the same reference appears as a readonly icon token and resource bar; raw footnote definitions are hidden from normal reading. The resource bar lays out stable icon tiles without surprise horizontal or vertical scrollbars. Internally, each icon atom uses the same two-layer SVG model: a base icon SVG layer and an info SVG layer. Screenshots show both states before final user walkthrough.

## Platform Diagnosis

- Current platform laws:
  - DB stores raw Markdown `message.content`.
  - WebChat owns the frontend Markdown resource grammar.
  - Message bubbles already use readonly CodeMirror projection.
  - Composer already uses writable CodeMirror but lacks resource widget parity.
- Does this fit as a regular atom:
  - Mostly yes. It is a frontend projection atom under the existing Markdown storage law.
- Does this require law upgrade:
  - Yes, a small frontend law upgrade: CodeMirror resource widgets must be shared projection atoms with mode-specific policies, not bubble-only implementation details.
  - The visual icon shape is also a shared atom. Comment/file/image should not reimplement number overlays independently in token, card, and bar code.
- Breaking update stance:
  - No DB break this round. Frontend class/DOM shape can change where tests and screenshots approve it.
- User confirmations still required:
  - User final visual walkthrough after screenshots.

## Reverse-Inferred Design

### Interaction / Visual Story

One Markdown message is like one sheet of paper under two lamps. The composer lamp lets the operator write on it. The bubble lamp turns the same marks into clean reading UI. The resource token should not feel like a random bracket code in either lamp.

### Interface Shape

- `ChatDraftEditor` accepts resource references in addition to completion capabilities.
- `MessageMarkdownContent` keeps its readonly resource context.
- A shared CodeMirror resource-token projection extension exposes reusable token widgets.
- A shared icon-with-number Svelte component renders comment, file, and image variants from one normalizer and CSS-variable theming:
  - comment: `MessageSquareDot` base icon, centered number.
  - file: `File` base icon, centered number, bottom-right extension badge.
  - image: `Image` base icon, corner number badge with the same ink color as the image glyph.
  - internal drawing: two stacked SVG layers, where the base icon layer owns the resource glyph and the info layer owns number/badge/extension marks.
- Readonly bubble mode may hide definition lines and render an aggregated bar.
- Writable composer mode should not hide source blocks or definitions unexpectedly; it only decorates inline resource references.

### Data Shape

- Durable fact: raw Markdown content.
- Draft state: pending frontend resources and editor text.
- Projection: CodeMirror decorations/widgets for inline tokens and resource bars.
- Visual atom data: resource kind, display number, optional file extension. Display number supports `1..9`; values outside that range render as `*`.
- Visual atom text sizing: numeric labels and extension labels use `font-size: 1rem` plus transform scaling, rather than shrinking the actual font-size below browser minimums.
- Visual atom drawing: all internal glyph, number, and badge marks are SVG children inside one coordinate model; the outer component remains a semantic Svelte wrapper for sizing, theming, and accessibility.
- Forbidden: `metadata.webChatCommentResources` or a hidden composer-only durable sidecar.

### Architecture Shape

- Shared CodeMirror projection atoms live under `src/components` or `src/composer` only if mode-specific.
- Resource icon composition lives behind a dedicated component and is consumed by inline token, sent/pending resource card, and resource bar surfaces.
- Resource icon internals should not mix HTML spans and SVG icon geometry for visible marks; the shared atom owns a layered SVG primitive so surfaces get consistent rendering by construction.
- Feature code must not parse Markdown twice with incompatible regexes.
- Composer must consume the same `WebChatResourceReference` shape used by readonly bubbles.
- Tests must cover behavior through public UI surfaces rather than private state fields.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Final visual acceptance | The user explicitly asked to walk through after agent screenshot checks. | Agent verifies screenshots first, then provides URL/screenshots for user review. |

## Intent-Driven Plan

- [ ] 1. Lock OpenSpec plan/spec/tasks for writable/readonly CodeMirror resource projection.
- [ ] 2. Extract or refactor shared CodeMirror resource token projection so composer and bubble use the same token widget law.
- [ ] 3. Wire `ChatDraftEditor` to receive live resource references and decorate inline resource tokens in writable mode.
- [ ] 4. Preserve readonly bubble behavior: footnote definition hiding, inline tokens, in-bubble resource bar, resource activation.
- [ ] 5. Add BDD/Storybook DOM coverage for writable composer CodeMirror and readonly bubble CodeMirror parity.
- [ ] 6. Run targeted tests/typecheck/OpenSpec validation.
- [ ] 7. Start the WebChat example or Storybook route, capture desktop and iPhone 14 screenshots, inspect the result, then provide the walkthrough entry to the user.
- [ ] 8. Rework shared resource visuals into one icon-with-number atom for comment/file/image, with `1..9` and `*` overflow display.
- [ ] 9. Refactor inline resource token, resource card, and resource bar to consume the atom instead of bracket text or duplicated icon overlays.
- [ ] 10. Rework `message-markdown-resource-bar` sizing so normal message resource strips do not show uncontrolled horizontal or vertical scrollbars.
- [ ] 11. Refresh BDD/DOM coverage and desktop/iPhone 14 screenshots for the accepted visual shape.
- [ ] 12. Upgrade icon theming so image icon/number share one ink color and variants can be recolored through CSS variables.
- [ ] 13. Rework file icon layout to put No in the center and the file extension in a bottom-right badge.
- [ ] 14. Replace small text font-size shrinking with `font-size: 1rem` plus scale transforms.
- [ ] 15. Add a multi-color/multi-background walkthrough matrix and refresh tests/screenshots.
- [ ] 16. Rework `ResourceIconWithNumber` internals to two stacked SVG layers: base icon layer plus info layer.
- [ ] 17. Preserve public kind/number/extension/theming behavior while removing HTML overlay drift from the visible marks.
- [ ] 18. Refresh DOM checks and screenshots for the layered-SVG icon atom.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should the composer display generated footnote definition text before send? | Displaying definitions while typing is noisy and may duplicate the resource rail. | No. The composer shows token affordances and resource rail; submit serializes definitions. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Reintroduce `webChatCommentResources` for composer convenience | Violates the storage law just fixed. |
| Make composer use the readonly bubble plugin wholesale | It would hide source text and structural blocks in an editor, breaking writable mental model. |
| Keep static Storybook harness as evidence | It does not instantiate real CodeMirror or the real composer. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: same visual or behavior mismatch recurring twice after fixes
- Custom exit condition from intent: screenshots and tests prove the composer is writable CodeMirror with resource-token affordances, message bubbles remain readonly CodeMirror with resource projection, DB send path remains markdown-only, resource icons use the shared icon-with-number atom, resource bars do not show uncontrolled scrollbars, and the user receives a walkthrough entry for final acceptance.
