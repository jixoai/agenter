# Agenter Demo

单包可行性实验：`agenter-ai` 通过 `@agenter/terminal` 管理通用终端进程与日志链路，OpenTUI 负责展示与交互。

## 面板布局

```txt
terminal | chat
    debug-log
```

## 运行

```bash
cd demo
bun install
bun run start
```

### Terminal Devtools 入口（人工调试模式）

```bash
bun run start:terminal-devtools
# watch
bun run dev:terminal-devtools

# iflow 快速入口（默认 --cmd=iflow 且 --git-log=normal）
bun run start:iflow-devtools
bun run dev:iflow-devtools
```

这个入口会启动：
- 左侧：可直接键盘输入的 Terminal（人工替代 agenter-ai）
- 右侧：Devtools（上方调试按钮，下方日志）
- Devtools 动作统一围绕 terminal output-dir：
  - `snapshot`：读取 `latest.log.html + pre-file` 链并导出完整正文 HTML
  - `markDirty/releaseDirty`：基于 workspace git commit + `git diff --patience -- output` 导出 patch

指定 agenter 工作目录（Terminal 进程 cwd）：

```bash
bun --watch run src/index.tsx -- --cwd ../your-project
# 或
bun --watch run src/index.tsx --cwd=../your-project

# 指定被控进程（默认: $SHELL -i）
bun run start:terminal-devtools -- --cmd "iflow" --cwd ../your-project
bun run start:terminal-devtools -- --cmd "codex"
bun run start:terminal-devtools -- --cmd "claude-code --dangerously-skip-permissions"
# 启用 terminal workspace git 历史（关键帧）
bun run start -- --git-log
# 启用详细提交模式
bun run start -- --git-log=verbose
# 指定 terminal 输出根目录
bun run start -- --ati-output-dir ../terminal-logs
```

崩溃复现实验（自动矩阵）：

```bash
bun run diagnose:terminal-crash -- --cwd=./tmp --runs=8 --duration-ms=7000
```

输出会保存到：
- `logs/terminal-devtools/analysis/report-*.md`
- `logs/terminal-devtools/analysis/report-*.json`
- `logs/terminal-devtools/analysis/raw/*.log`

## 可选环境变量

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com/v1`）
- `DEEPSEEK_MODEL`（默认 `deepseek-chat`）

未配置 `DEEPSEEK_API_KEY` 时会使用本地回退策略（不阻塞 Demo）。

## 提示词文件

- `prompts/agenter-system.md`
- `prompts/iflow-workflow.md`
- `prompts/iflow-help.md`

运行中可在 chat 输入 `/reload` 热加载提示词。

## 日志目录

- 运行日志：`logs/demo-*.jsonl`
- 测试日志：`logs/test/demo-*.jsonl`
- devtools 日志：`logs/terminal-devtools/demo-*.jsonl`
- devtools 快照/脏区导出：`logs/terminal-devtools/artifacts/*.json`
- devtools 文本产物：`logs/terminal-devtools/artifacts/*.html|*.patch`
- terminal workspace 日志链：`<ati-output-dir>/<YYYY>/<MM>/<DD>/<HH_mm>-<pid>/output/*.log.html`
- terminal git 调试日志（启用 `--git-log` 后）：`.../debug/git-log.ndjson`

## 快捷键

- `Enter`: 提交 chat 输入
- `Shift+Enter`: chat 输入换行
- `Tab`: 切换焦点
- `Ctrl+L`: 清空 terminal 视图
- `Up/Down`: 在 debug 面板滚动日志
- `Ctrl+Shift+C` / `Cmd+C`: 复制当前选中内容
- `Ctrl+C`: 退出
