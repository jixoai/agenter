## Why

The terminal projection law is now stable enough to polish the interaction layer without re-opening the larger architecture. The remaining native experience gaps are small but important: input after scroll must return to the cursor, double-click and triple-click selection must behave like a terminal, and the shell scrollbar must visibly communicate progress.

### User Objective Anchors

The following user statements are copied as acceptance anchors for this change:

> `我的目的不是为了开进城，而是为了能独立选择和复制`

> `如果你要在“离屏渲染器交互层”实现双击选中单词，你的技术选择是什么？是直接空格切割？这不合理吧？`

> `我直接给你方案，这是参考代码： function findWordInTerminal(text, charIndex) { ... Intl.Segmenter(undefined, { granularity: 'word' }) ... isWordLike ... }`

> `如果我往回滚动，然后进行输入的时候，应该立刻回到光标输入的位置`

> `双击选中单词，三级选中单行`

## What Changes

- Add terminal interaction behavior to the offscreen renderer interaction layer:
  - keyboard input to shell follows the cursor back into view after the input is sent;
  - double-click selection selects one word using `Intl.Segmenter`;
  - triple-click selection selects the whole terminal row;
  - selection remains bounded to the owning shell/dialogue region;
  - scrollbar thumb/progress remains visible and tied to backend viewport truth.
- Keep copy and selection ownership inside the backend frame projection component, not terminal-2 compositor overlays.
- Add BDD coverage for the interaction behaviors and focused visual contract checks for scrollbar progress.
- Do not introduce a new backend or process solely for these polish tasks.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `terminal-screen-projection-law`: Adds offscreen interaction-layer requirements for cursor-follow input, semantic double/triple click selection, bounded region ownership, and scrollbar progress projection.
- `cli-shell-app`: Adds cli-shell app requirements for shell input after scroll, terminal-like word/line selection gestures, and visible shell scrollbar progress.

## Impact

- `packages/cli-shell/src/tui/backend-frame-renderable.ts`
- `packages/cli-shell/src/tui/backend-terminal-frame.ts`
- `packages/cli-shell/src/tui/backend-scrollbar.ts`
- `packages/cli-shell/src/tui/controller.ts`
- `packages/cli-shell/src/tui/core-app.ts`
- `packages/cli-shell/test/cli-shell-tui.test.ts`
- `packages/cli-shell/test/live-terminal-mirror.test.ts`
- `openspec/specs/terminal-screen-projection-law/spec.md`
- `openspec/specs/cli-shell-app/spec.md`
