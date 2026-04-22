## Context

terminal input 现在处在一个“意图正确但法则不完整”的阶段。

一方面，`AgenticTerminal.enqueuePendingInput(...)` 已经把 automation 输入建模成：

- `input/pending/*`
- `input/done/*`
- `input/failed/*`

并且 `InputInbox` 会顺序扫描 pending 文件，形成一个 durable automation queue。

另一方面，platform 仍然保留：

- `writeMixed(...)`：直接进入内存 write queue
- `writeRaw(...)`：直接写 PTY

这意味着“automation authoritative path 是 pending queue”并没有被正式写成硬法则。与此同时，runtime tool surface 又把 `terminal write` 暴露成了一个混合 raw/submit 语义的接口，进一步模糊了 raw 与 mixed 的边界。

## Goals / Non-Goals

**Goals**

- 保留双通道设计，但把边界写成 durable contract。
- 把 automation 输入收口成两种 explicit pending mode：
  - raw
  - mixed
- 让 mixed 语法支持安全地表达字面量 `<key .../>` 和 `<wait .../>`
- 让 AI 能通过 `--help` + skill 正确学习 raw vs mixed
- 通过注释和 BDD tests 把这套法则锁死，避免未来再次偏移

**Non-Goals**

- 不把所有人类实时输入都强制改成 pending queue
- 不在这轮引入 binary/raw-bytes transport
- 不重做 terminal WebUI 成双模式编辑器
- 不改变 websocket transport 的存在价值，只收口它的语义边界

## Decisions

### 1. 保留双通道，但把“谁能走哪条路”写成硬法则

terminal input 保持两个正交通道：

- **Automation authoritative path**
  - 通过 pending 文件进入 terminal core
  - 适用于 AI、runtime-local CLI、control-plane、durable automation
- **Interactive forwarding path**
  - 通过 `writeRaw(...)` 直接写 PTY
  - 只允许 ATI-CLI/TUI 这种真人实时 forwarding 使用

为什么：

- 真人实时 typing 需要最小延迟，保留 raw forwarding 是合理的
- AI / automation 需要 durable queue、done/failed、mode-aware parsing，这必须走 pending

### 2. `terminal write` 收口成 pure raw；mixed 升格为 `terminal input`

- `terminal write`
  - raw-only
  - 不再支持 `submit`、`submitKey`、`submitGapMs`
  - `text` 原样写入 terminal
- `terminal input`
  - mixed-only
  - `text` 使用 mixed input DSL
  - mixed 标签由 parser 解释

为什么：

- `write` 这个命名天然更贴近 raw text / raw stream
- mixed 是一种 DSL，不应继续伪装成普通 write payload

### 3. pending 文件后缀切换成显式 mode suffix

新唯一合法后缀：

- `.raw.txt`
- `.mixed.txt`

不再接受：

- `.xml`
- 旧的裸 `.txt`

为什么：

- 现有 mixed 语法不是标准 XML，继续使用 `.xml` 会误导
- `.raw.txt` / `.mixed.txt` 能同时表达模式和“这是文本文件”

### 4. mixed 语法新增 `<raw>...</raw>`

在 mixed parser 中新增 raw block：

- `<raw>...</raw>` 内部不解析 `<key .../>` 或 `<wait .../>`
- raw block 内容在写入前解码固定的 HTML entities
- raw block 不允许嵌套
- raw block 缺失闭合标签时视为 parse error

支持的 entity 固定为：

- `&lt;`
- `&gt;`
- `&amp;`
- `&quot;`
- `&#39;`

为什么：

- mixed mode 需要一个安全的“字面量区”
- 使用 HTML entities 与现有 HTML-like 语法最一致

### 5. `wait` 必须继续保持双重语义分离

`wait` 继续有两种独立含义：

- mixed DSL 的 `<wait ms=\"...\"/>`
  - 表示终端输入动作序列中的暂停
- `TerminalPendingInputOptions.wait`
  - 表示调用方是否等待 pending 文件进入 `.done` / `.failed`

注释、skill、tests 都必须明确区分，禁止再次混淆。

### 6. Browser/global terminal API 也要暴露 raw vs mixed 两个 surface

不仅 runtime-local CLI 要区分 `terminal write` 和 `terminal input`，global terminal control-plane 也应保持同构：

- raw write API
- mixed input API

即便 WebUI 第一阶段仍只使用 raw write，也必须把 mode boundary 做成正式 control-plane contract。

### 7. help 负责发现，skill 负责深读

- `terminal write --help`
  - 明确 raw mode
  - 指向 `skill info agenter-terminal`
- `terminal input --help`
  - 明确 mixed mode
  - 指向同一个 skill
- terminal skill reference
  - 负责详细讲 raw vs mixed、`<raw>`、pending suffixes、典型场景

## Risks / Trade-offs

- [Breaking change] 旧 `terminal write + submit` 调用全部失效
  - 通过同步迁移 runtime/client/tests 收口，不保留兼容 alias
- [Parser strictness increases] raw block 缺闭合标签会导致 pending failed
  - 这是有意为之，避免 silent drift
- [Two public APIs instead of one]
  - 这是必要的语义拆分，不是表面复杂化

## Migration Plan

1. 新建 OpenSpec capability，并更新 runtime/terminal 相关 specs。
2. 重构 terminal core：
   - pending mode suffix
   - raw block parser
   - pending-only automation path
3. 重构 control-plane/runtime descriptors：
   - `terminal write` raw
   - `terminal input` mixed
4. 更新 skill/help/reference。
5. 补 terminal-system、app-server、client-sdk 的 BDD tests。
6. 同步 durable package specs 并 archive change。
