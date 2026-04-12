## Context

新的 skills+CLI 架构已经把 attention/message/workspace/terminal 的使用面收缩到 root workspace bash 内。但 CLI 不是简单把 HTTP body 暴露出来就够了，尤其是 attention 收尾这种高频动作，AI 会天然使用 shell 风格命令，而不是每次都现写一段 JSON heredoc。

当前平台的问题有两个：

1. `attention commit` 只支持 JSON，和 shell/AI 的自然表达不一致；
2. runtime-local API 暴露了 `done`，但没有实现和内置 tool 一致的“清零当前 context active scores”语义。

## Decision

### 1. JSON 仍是完整真源，flag-form 只是高频投影

`attention commit` 最终仍然提交同一个 JSON payload 到 runtime-local API。CLI 只新增一层壳，把最常见的 shell 用法投影回这个 payload：

- `--context` / `--context-id`
- `--summary`
- `--done`
- `--score 0` 作为 `--done` 的简写
- `--score key=value` 作为显式 score 覆盖
- 常见 meta/change flags

复杂 egress 或复杂 payload 继续走 JSON/stdin，不在 flag 层把所有字段无限铺开。

### 2. `done` 语义属于 runtime attention commit law，不属于某个客户端 hack

当 runtime-local API 收到：

- `done: true`
- 且没有显式 `scores`

runtime SHALL 自动把当前 context 中所有 `score > 0` 的 score key 归零，再写入 commit。这和内置 `attention_commit` tool 已有行为保持一致。

这样：

- shell CLI
- 未来其它 API client
- 内置 tool

都共享同一个“done means resolve active debt”法则。

### 3. `--score 0` 只作为收尾捷径，不引入模糊 score 写法

为避免 CLI 表面方便、语义却模糊：

- `--score 0` 表示“把当前 context 的 active scores 归零”，等价于 `--done`
- `--score <non-zero>` 如果没有 score key，则直接报错
- 精确写分数必须显式写成 `--score key=value`

这样可以兼容 AI 的自然收尾写法，又不会让 CLI 进入“猜用户想改哪个 score key”的不确定状态。

## Validation

- 单元/集成测试覆盖：
  - flag-form `attention commit --context ... --score 0 --summary ...`
  - `done` 语义自动归零 active scores
  - JSON payload 入口继续可用
- 真实 AI 回归：
  - `real-room-terminal.integration.test.ts`
  - `real-room-terminal-cold-restart.integration.test.ts`
