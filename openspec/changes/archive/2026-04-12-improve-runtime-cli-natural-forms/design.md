## Context

当前大架构已经切到：

- system prompt 只给 minimal runtime law
- 模型直连工具只有 `root_workspace_list` / `root_workspace_bash`
- room / terminal / workspace / attention 都通过 shell CLI 暴露

这套设计本身没有问题，问题出在 CLI surface 还不够像一个 AI 友好的壳层。真实模型不是先背熟一套 positional-only 命令再工作，而是会按通用 CLI 直觉去尝试 named flags，再在失败后求助 `ccski info ...` 或 `--help`。

这说明当前问题不是底层 runtime truth，而是 shell compatibility law：

- API 真相层已经够清楚
- shell 壳层没有把“人类/AI 最自然的调用形态”接住

本次必须坚持单一信源和层次分离：

- 私钥、身份、room 权限、workspace 权限都不改
- runtime-local API 契约不改
- attention completion 的真相仍然只由 `attention commit` 决定
- 仅在 shell parser 层增加等价命令形态和帮助输出

## Goals / Non-Goals

**Goals:**
- 让 runtime CLI 接住模型最常见的自然 flag-form 写法
- 避免 `--help` 这类探测行为误打成真实业务参数
- 保持现有 positional 语法完全可用
- 用真实 AI 交付回归证明 room + terminal 链路不再因为 CLI 壳层断层而挂掉

**Non-Goals:**
- 不修改 runtime-local API 的请求 schema
- 不把 `message send` 变成 completion 的自动真相
- 不支持任意自由组合的“超宽松”命令语法；只接住已经在真实走查里高频出现的自然形态
- 不重新把大量 guide 塞回 bootstrap；discoverability 仍以 skills + shell help 为主

## Decisions

### 1. 兼容只发生在 shell parser，底层 API 保持严格

这是最重要的层次边界。`message send --room ... --content ...` 之所以应该成立，不是因为 `/v1/message/send` 要改，而是因为 shell CLI 作为 AI-facing façade，本来就应该把等价命令归一化后再发给 API。

这样可以同时满足两件事：

- 原则层保持单一、严格、可推理
- AI-facing 壳层保持宽容、可恢复、低心智负担

### 2. 只支持真实高频自然形式，不做“万能解析器”

本次只为真实调试中已经观察到、且明显符合 CLI 通用直觉的形态做兼容：

- `message read --room <chatId> --limit <n>`
- `message send --room <chatId> --content <text>`
- `terminal write <terminalId> --input <text> [--submit]`

同时保留 positional 形式为 canonical contract：

- `message read <chatId> [limit]`
- `message send <chatId> <content>`
- `terminal write <terminalId> <text> [--submit]`

### 3. `--help` 必须在 shell 层短路返回，而不是落到业务解析

真实模型会主动试 `message send --help` 这种命令。如果 parser 不先消费它，它就会被当作 chatId 或普通参数，制造新的无意义错误。

因此帮助输出应满足：

- 不触发 runtime API 请求
- 返回 exit code `0`
- 只给最小、直接、面向动作的 usage

### 4. skills 只负责提示“有这条路”，CLI 负责真正接住

`ccski info agenter-terminal` 已经能告诉模型 canonical 用法，但真实模型仍然会先按自己的 CLI 直觉尝试。这是合理行为，不应该全部依赖技能文案来纠偏。

所以这次的责任划分是：

- `runtime-skills.ts`: 提醒 named flag form 也可用，并给出 canonical 例子
- `runtime-cli.ts`: 真正把 natural form 解析成稳定 payload

## Risks / Trade-offs

- [Risk] parser 兼容过多，会让 shell 语义变得模糊
  → Mitigation: 只支持真实高频形态，并在测试中锁定优先级：named flags 优先，其次 positional，其次 stdin

- [Risk] `--help` 输出和 skills 文案重复
  → Mitigation: help 只保留最小 usage，详细说明仍然放在 `ccski info ...`

- [Risk] 支持 `--input` 后，模型可能更依赖 flag-form 而不是 heredoc
  → Mitigation: skills 仍然继续推荐 heredoc / stdin 处理长文本；兼容并不改变最佳实践

## Migration Plan

1. 为 `runtime-skills-cli-surface` 补 delta spec，明确 shell façade 需要兼容自然 flag form
2. 在 `runtime-cli.ts` 中补 message/terminal 的命令解析与 `--help`
3. 在 `runtime-skills.ts` 中补充 named flag discoverability
4. 增加单测覆盖 parser 归一化与 help 短路
5. 重跑真实 AI room-terminal 交付回归

回滚策略：

- 如果兼容解析引入歧义，回滚到更窄的 alias 集合，但保留 help 输出与真实回归测试

## Open Questions

- 是否还要让 `message list --limit <n>` 在 shell 层做本地裁剪兼容；本次先不依赖它修复主链路，除非回归中再次证明它是必要断点
