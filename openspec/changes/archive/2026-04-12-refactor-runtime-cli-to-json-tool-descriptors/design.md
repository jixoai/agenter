## 背景

当前 runtime shell surface 存在三个结构性问题：

1. 同一个能力被重复定义
   - `runtime-local-api.ts` 自己维护 route + schema + handler 绑定
   - `runtime-cli.ts` 自己维护 parser + help + route mapping
   - `runtime-skills.ts` 再写一份示例和语义说明
2. façade 层可以偷偷改语义
   - 例如 `message list --limit` 只在 shell 层本地裁剪输出，但 runtime API 本身并不知道这个 contract
3. AI surface 不够“可推导”
   - AI 看见的是一堆人写死的字符串，而不是一个稳定的“工具描述 -> 帮助 -> 执行”的统一法则

这违背了当前内核最重要的设计原则之一：平台法则先行，能力原子通过统一 contract 挂载，不允许每一层自己补一份业务真相。

## 目标

- 用单一 descriptor 真源定义 runtime CLI/API 能力
- 让 CLI 输入 contract 回到最小、最稳定的 JSON object 语义
- 让 `--help`、skills、未来 HTTP/OpenAPI 都能复用同一份描述
- 保持 `ccski` / `tool` 这类 root workspace 本地原语继续存在，但不把它们混进 runtime-local API descriptor 范围

## 非目标

- 不做向下兼容
- 不保留 natural-form parser
- 不把 `ccski` / `tool` 也抽成 runtime-local API
- 不在本次顺手扩张到 task system；先收敛 `attention` / `message` / `workspace` / `terminal`

## 新的平台法则

### 1. Descriptor 是唯一真源

新增一个 shared module，例如 `runtime-tool-descriptors.ts`，由它声明 runtime tool descriptor：

- `namespace`
- `name`
- `description`
- `inputSchema`
- `route`
- `examples`
- `handler`

`handler` 的职责是把 validated input 映射到 runtime-local handler，然后返回稳定 JSON result object。

这样一来：

- local API route table 由 descriptor 生成
- shell CLI subcommand 由 descriptor 生成
- `--help` 输出由 descriptor 生成
- runtime skills 中的 canonical example 也能复用 descriptor

### 2. CLI 只接受 JSON object

CLI 输入统一为：

- 空输入：等价于 `{}`，只适用于 input schema 本身允许空对象的命令
- 单个 argv：必须是一个 JSON object 字符串
- stdin：必须是一个 JSON object 字符串

明确禁止：

- positional 参数
- `--room` / `--content` / `--input` 这类 façade flag
- argv 与 stdin 同时提供两份 payload

这样做的意义是：AI 不再需要记忆每个命令的临时 parser 习惯，只需要知道“这是一个 JSON tool call，经 bash 转发”。

### 3. Help 不是手写文案，而是 descriptor 投影

每个 subcommand 的 `--help` 输出固定包含：

- command 名称
- description
- JSON input schema
- canonical examples

这意味着帮助文档和真正执行使用同一份 schema，不会再出现“help 是 A，parser 接受 B，API 实际又是 C”的三分裂。

### 4. Skills 只教 canonical form

runtime built-in skills 不再提供 natural-form 示例，而是只保留：

- JSON argv 示例
- JSON stdin/heredoc 示例
- `--help` / `ccski info` 的发现路径

skills 的职责是教 AI 如何渐进发现，不是给 parser 留后门。

## 模块分层

### 平台法则层

- `runtime-tool-descriptors.ts`
  - schema
  - descriptor registry
  - help rendering
  - CLI JSON payload parsing helper
- `runtime-local-api.ts`
  - 只负责 HTTP transport、鉴权、descriptor dispatch
- `runtime-cli.ts`
  - 只负责 namespace command 装配、descriptor help、descriptor dispatch

### 原子实现层

- `session-runtime.ts`
  - 提供 runtime handler 实现
- `runtime-skills.ts`
  - 用 descriptor 输出 canonical examples，并补充使用哲学

## 关键设计细节

### Message list 的壳层裁剪问题

旧实现中 `message list --limit` 只是 shell 层自己裁剪返回值。这个设计破坏了单一信源，因为 CLI 和 API 的行为不一致。

本次处理方式：

- 如果保留该能力，就把 `limit` 明确写进 descriptor schema，并在 descriptor handler 中统一处理
- 否则直接删除该 façade 行为

原则是不允许“只有 CLI 才知道”的输入语义继续存在。

### Attention commit 的 done 语义

`attention commit` 的 `done=true` 特殊语义属于真正的平台法则，不应该因为 CLI 重构而丢失。

因此：

- input schema 仍保留 `done?: boolean`
- runtime-local descriptor handler 继续把 `done=true && scores 未显式提供` 解释为“解析当前 active score keys 并置零”
- CLI 只负责把 JSON 原样送入 descriptor contract，不再自己发明 `--score 0` 这种 shorthand

### ccski / tool 保持为本地 shell 原语

`ccski` 与 `tool` 不是 runtime-local attention API 的子命令，而是 root workspace shell 原生能力：

- `ccski` 负责 skill discovery
- `tool` 负责运行 `~/tools/*`

它们继续作为 custom command 存在，但不进入 runtime tool descriptor registry。

## 风险与应对

### 风险 1：真实 AI 一开始还会尝试旧语法

应对：

- skills 中明确给 canonical JSON 示例
- `--help` 输出足够短、足够直接
- legacy 语法报错信息要清楚，直接指出“需要 JSON payload”

### 风险 2：schema JSON 输出过长

应对：

- `--help` 只展示 input schema
- examples 控制在 1-3 个
- built-in skills 只挑高频命令展示 canonical example，避免把所有 schema 都塞进 prompt

### 风险 3：descriptor 改造过程中打破真实交付链路

应对：

- 先补单测锁住 CLI/API 行为
- 再跑真实 AI `real-room-terminal.integration.test.ts`
- 必要时分析真实 AI-call 与 bash 调用记录，确认模型已经切到 JSON form

## 验证策略

1. BDD 单测
   - runtime CLI JSON argv / JSON stdin / `--help`
   - legacy flag / positional form rejection
   - runtime skills 内容更新
2. 集成回归
   - root workspace bash 里真实执行 JSON form attention/message/terminal 命令
3. 真实 AI 验证
   - `AGENTER_RUN_REAL_LOOPBUS=1 bun test packages/app-server/test/real-room-terminal.integration.test.ts`
   - 检查真实 AI-call 中是否通过 bash 使用 JSON CLI 完成 room + terminal 交付链路

## 大白话总结

以前是三个地方各写一份“这个工具怎么用”。

- API 说一套
- CLI parser 说一套
- skills 文案再说一套

所以越修越乱。

这次就是把它们全部收回到一张“工具说明书”上。以后不管是：

- AI 走 bash
- 本地 loopback API
- `--help`
- 以后接 HTTP/OpenAPI

都从同一份 descriptor 长出来。CLI 也不再玩人类工程师式的 flag 猜谜，直接收 JSON，简单、稳定、可验证。
