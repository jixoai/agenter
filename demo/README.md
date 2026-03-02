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

默认会加载 `demo/.agenter/settings.json`，并据此决定：
- 终端预设与自启动（`terminal.presets` + `features.terminal.bootTerminals`）
- AI 配置（`ai.*`，例如 DeepSeek）
- 提示词根目录（默认从 settings source 目录推导）
- 语言包（`lang`，默认 `en`，无效值自动回退到 `en`）

### Terminal Devtools 入口（人工调试模式）

```bash
bun run start:terminal-devtools
# watch
bun run dev:terminal-devtools

# iflow 快速入口
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

## AI 配置（推荐通过 settings）

- `demo/.agenter/settings.json` 的 `ai` 字段是主配置
- 常用字段：`provider/baseUrl/model/temperature/maxRetries/apiKey/apiKeyEnv`
- 若未配置 `apiKey`，会读取 `apiKeyEnv`（默认可用 `DEEPSEEK_API_KEY`）

未配置 `DEEPSEEK_API_KEY` 时会使用本地回退策略（不阻塞 Demo）。

## Terminal 焦点策略（LoopBus / Tool 协同）

`settings.json` 使用 `features.terminal`：

- `bootTerminals`: `Array<string | { id, focus?, autoRun? }>`
  - `focus=true` 的 terminal 会成为初始焦点（exclusive 模式仅一个焦点）
  - `autoRun=false` 的 terminal 不会在启动时自动运行
- `focusMode`: 当前固定 `"exclusive"`
- `unfocusedSignal`: 当前固定 `"summary"`

运行时语义：
- focused terminal：LoopBus 自动注入 diff（默认 `remark=true`）
- unfocused terminal：LoopBus 只注入 dirty summary
- AI 如需 unfocused terminal 的细节，可主动调用 `terminal_sliceDirty`
- 对 focused terminal 调 `terminal_sliceDirty` 会得到 `ignored=true`

## 统一资源加载器

`@agenter/settings` 现在使用统一 ResourceLoader 解析并读取资源，支持：
- `user` / `project` / `local` 内置 source
- 路径：`./`、`../`、`/`、`~/`
- 协议：`file:`、`http:`、`https:`
- 自定义扩展：可注册 alias（如 `git:`、`npm:`、`jsr:` 的前置映射）和 protocol handler

因此提示词路径可以直接使用远程 URL，例如：

```json
{
  "terminal": {
    "presets": {
      "iflow": {
        "command": ["iflow"],
        "helpSource": "https://developers.openai.com/codex/cli/slash-commands.md"
      }
    }
  }
}
```

## 提示词文件

- `demo/.agenter/AGENTER.mdx`
- `demo/.agenter/man/iflow.md`

说明：
- `AGENTER.mdx` 是用户自由覆盖层，可以为空。
- 核心工作方式与系统模板由 i18n 包内置（`packages/i18n-*/prompts/*.mdx`）。
- 终端 help 通过 `terminal.presets.<id>.helpSource` + `terminal_run` 的 `<CliHelp command="..."/>` 注入。

运行中可在 chat 输入 `/reload` 热加载提示词。

## 多语言提示词包

- 语言包目录：
  - `packages/i18n-en/prompts/*.mdx`
  - `packages/i18n-zh-Hans/prompts/*.mdx`
- `settings.lang` 控制当前语言（如 `en` / `zh-Hans`）。
- 默认语言是 `en`，找不到或写错语言时自动回退到 `en`。

`@agenter/app-server` 的语言包解析模式：

- `dev` 模式：读取 `@agenter/app-server` 的 `peerDependencies`。
  - 版本为 `workspace:*` 时，直接读取工作区 `packages/i18n-*/prompts/` 源文件。
- `prod` 模式：当 `peerDependencies` 版本是固定 semver（如 `0.0.1`）时：
  - 自动下载 npm 语言包并缓存到 `~/.agenter/i18n/<lang>@<version>/prompts.json`。

说明：
- `@agenter/i18n-en` 同时是 `@agenter/app-server` 的 `dependencies` 与 `peerDependencies`，保证默认包可用且版本联动可见。

构建语言包（从 `prompts/*.mdx|*.md` 生成 `prompts.json`）：

```bash
bun run build:i18n
```

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
