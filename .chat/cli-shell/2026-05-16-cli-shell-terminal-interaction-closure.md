# cli-shell 终端交互收口报告

日期：2026-05-16

## 结论

本轮 `polish-cli-shell-terminal-interactions` 已完成、测试通过、同步长期 spec，并归档。

本轮没有继续改终端传输架构，也没有新增 backend 进程。所有新交互都收敛在“离屏渲染器交互层”，也就是 `BackendFrameRenderable` / `BackendScrollbarRenderable` / cli-shell TUI 这条路径上。

## 本轮完成内容

1. 输入后回到光标
   - shell 输入成功发送到 live mirror 后，会请求已有的 `followCursor()`。
   - 如果 live mirror 拒绝输入，不会请求 follow cursor。
   - dialogue 输入不会触发 shell follow cursor。

2. 双击选词
   - 双击选词在 `BackendFrameRenderable` 内实现。
   - 选词使用 `Intl.Segmenter(undefined, { granularity: "word" })`。
   - 不使用空格切割。
   - CJK/ASCII 混合文本有 BDD 覆盖。

3. 三击选行
   - 三击选中当前 owner region 内的一行。
   - 不跨 shell / dialogue / scrollbar / toolbar。

4. 复制路径
   - drag selection 和 semantic selection 共享 `getSelectedText()` 这一条复制读取路径。
   - `CoreApp` 的 copy 逻辑先读 OpenTUI 全局 drag selection；如果没有，再读 terminal view 自己的 semantic selection。

5. scrollbar 进度
   - scrollbar 仍然以 backend viewport state 为真相。
   - 点击/拖动 scrollbar 只发送 backend viewport target。
   - 可见进度来自 backend `scrollSize / viewportSize / scrollPosition`。
   - 没有在 compositor 里新画第二套 scrollbar 真相。

## OpenSpec 状态

已归档：

- `openspec/changes/archive/2026-05-16-polish-cli-shell-terminal-interactions/`

本轮同步到长期 spec：

- `openspec/specs/terminal-screen-projection-law/spec.md`
- `openspec/specs/cli-shell-product/spec.md`

当前 `openspec list --json` 剩余状态：

- `separate-cli-shell-product-from-terminal-view-components`：82/86，in-progress
- `add-cli-shell-web-host`：26/26，complete
- `promote-ghostty-native-terminal-backend`：8/8，complete
- `promote-ghostty-native-cli-shell`：14/14，complete
- `extend-attention-cli-self-evolution-runtime`：0/11，in-progress
- `workspace-mounted-systems-and-attention-contexts`：0/6，in-progress
- `add-runtime-recovery-surface`：0/9，in-progress
- `add-on-demand-otel-capture`：0/16，in-progress

说明：本轮只归档当前 change。旧的 complete changes 没有在本轮重新验收，所以没有擅自归档。

## 提交

- `dcdbf7be docs(spec): propose cli-shell terminal interaction polish`
- `35706839 feat: polish cli-shell terminal interactions`
- `d58eb891 docs(spec): archive cli-shell terminal interaction polish`

## 自动化验证

已通过：

- `openspec validate polish-cli-shell-terminal-interactions --strict`
- `bun test packages/cli-shell/test/cli-shell-tui.test.ts --timeout 120000`
  - 47 pass
- `bun run --filter '@agenter/cli-shell' typecheck`
- `bun run --filter '@agenter/cli-shell' test`
  - 103 pass
  - 3 skip
- `bun test packages/terminal-transport-protocol/test/terminal-transport-protocol.test.ts --timeout 20000`
  - 9 pass
- `bun test packages/terminal-system/test/control-plane.test.ts --timeout 120000`
  - 59 pass
- `openspec validate --changes --strict`
  - 8 passed, 0 failed
- `openspec validate --specs --strict`
  - 160 passed, 0 failed

测试中观察到两个非失败 warning：

- OpenTUI `DataPathsManager` listener warning。
- cli-shell web host 测试关闭 Vite dev server 时出现一次 dep-scan outdated warning。

它们没有导致测试失败，也不是本轮交互改动引入的行为断言失败。

## 人工走查重点（大白话）

请你后续重点看这些点：

1. 往上滚动 shell 以后，再敲字，画面应该回到正在输入的位置。
2. shell 里双击一个词，应该只选中这个词。
3. shell 里三击一行，应该只选中这一行。
4. dialogue 里双击/三击，也应该只在 dialogue 里面选，不应该选到 shell。
5. 选中后复制，应该能复制到刚才选中的词或行。
6. 单击不应该出现拖选那种选中效果。
7. scrollbar 的进度应该看得出来，而且滚动后位置会变。
8. 点击或拖动 scrollbar 后，内容应该跟着 backend 返回的画面更新，不应该自己先乱跳。
9. 中文、emoji、普通英文混在一起时，双击选词不应该靠空格瞎切。
10. 如果发现卡顿、残影、光标错位，优先反馈：操作步骤、是否在 shell/dialogue、是否刚滚动过、是否刚 cat 大文件。

## 残余风险

- 双击/三击依赖 OpenTUI mouse down 事件，没有原生 clickCount 时使用短时间同坐标点击计数。自动化测试覆盖了 OpenTUI test renderer 的 double click 和 triple click 模拟，但 Ghostty-native 的真实体感仍需要你走查。
- 旧的 complete OpenSpec changes 仍在 active list 中。本轮没有重新验证它们，所以只记录状态，不归档。
