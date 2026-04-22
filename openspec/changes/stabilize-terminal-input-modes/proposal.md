## Why

当前 terminal input 已经事实性地分成了两条路径：

- automation / AI 倾向于通过 `input/pending/*` 投递 mixed input
- ATI-CLI/TUI 的真人实时输入通过 `writeRaw(...)` 直通 PTY

但这套双通道哲学还没有被正式收口成 durable contract。现状里：

- `terminal write` 仍然混合了 raw text、implicit submit、mixed-like 心智
- pending 文件后缀还是历史遗留的 `.xml | .txt`
- mixed 语法无法安全表达字面量 `<key .../>`
- skill / `--help` 只教了 CLI JSON 形式，没有把 raw vs mixed 的选择法则教清楚

如果继续沿用现状，terminal input 语义会继续在 parser、pending inbox、runtime tool surface、skill 文档之间漂移。

## What Changes

- Stabilize terminal input around two explicit authoritative modes:
  - `terminal write` => raw pending input
  - `terminal input` => mixed pending input
- Preserve the original dual-channel architecture:
  - automation / AI / control-plane writes go through pending files
  - `writeRaw(...)` remains as the interactive-only PTY forwarding path for ATI-CLI/TUI
- Add `<raw>...</raw>` blocks to mixed input so literal tag-like text can be emitted safely.
- Replace legacy pending suffixes with explicit mode suffixes:
  - `.raw.txt`
  - `.mixed.txt`
- Teach raw vs mixed selection through runtime help and terminal skill references.

## Capabilities

### New Capabilities

- `terminal-input-modes`: Terminal core and runtime tools expose explicit raw and mixed pending input modes.

### Modified Capabilities

- `runtime-json-tool-descriptor-surface`: runtime-local CLI/help now distinguishes `terminal write` raw mode from `terminal input` mixed mode.
- `terminal-collaboration-access-control`: all automation-facing terminal input paths keep the same grant / approval / lease policy while remaining mode-aware.
- `terminal-pty-transport`: websocket PTY transport remains a collaboration-governed raw forwarding path, not a bypass around terminal authority.

## Impact

- `packages/terminal-system/src/*`
- `packages/app-server/src/*`
- `packages/client-sdk/src/*`
- `packages/terminal-system/skills/terminal/*`
- `openspec/specs/terminal-input-modes/spec.md`
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
