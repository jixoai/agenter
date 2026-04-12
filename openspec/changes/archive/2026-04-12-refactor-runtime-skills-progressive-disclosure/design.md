## 背景

Anthropic 的 skill 最佳实践里，核心思路不是“把所有知识塞进 SKILL.md”，而是：

- `description` 清楚说明 skill 做什么、何时触发
- `SKILL.md` 保持短、可扫描、可直接行动
- 更详细的资料放进 sibling references 文档，按需读取

我们当前的 runtime built-in skills 还停留在“让 AI 成功，所以把所有 workaround 都写进去”的阶段。这导致三个结构性问题：

1. skill 不再专注
   - `terminal` 里写了 URL host contract 和 room delivery 时机
   - `message` 里写了 curl / host verification
   - `attention` 里写了 owning-room report
2. 同一条法则被多个 skill 重复书写
   - delivery verification / final report / exact host contract 到处都是
3. `ccski info` 已经能返回真实 path，但 prompt 没有把“继续沿 path 读 references”的方法教给 AI

## 目标

- 让 built-in skills 回到 concise overview，而不是长篇操作手册
- 让细节沿着真实文件路径渐进展开
- 保持 AI 可用性，不让 skill 变得“短了但不会用”
- 收紧各原子 skill 的职责边界，减少跨系统知识泄漏

## 非目标

- 本次不实现新的底层 delivery verifier primitive
- 本次不重写 runtime shell / ccski 协议
- 本次不做 skill database / embedding / 搜索系统
- 本次不解决所有 prompt 层的架构问题，只收口 skills authoring + discovery path

## 新的平台法则

### 1. `SKILL.md` 只保留“能触发行动的最小信息”

每个 built-in skill 的 `SKILL.md` 应只包含：

- skill 名称与 description
- 这个 skill 解决什么问题
- 什么时候应该用它
- 最小 checklist / quick start
- references 索引

不再允许：

- 把大量扩展背景、长流程、跨系统补丁内联到正文
- 同一条底层法则在多个 skill 中重复出现

### 2. 详细材料必须下沉到 sibling `references/*.md`

每个 skill 可以拥有一个或多个 `references/*.md`：

- `references/discovery.md`
- `references/terminal-lifecycle.md`
- `references/room-protocols.md`

这些 reference 文档用于承载：

- 更完整的案例
- 扩展流程
- 背景约束
- 多步策略

但 references 也必须服从边界：

- 原子 skill 的 references 仍然只写自己的职责范围
- 不能把“底层缺少 verifier，所以先在 terminal skill/reference 里补一套网络法则”继续藏进去

### 3. 全局 prompt 明确教授“真实 path -> references”的发现法

`ccski info <skill>` 已经会返回 `SKILL.md` 的真实文件路径。全局 system prompt 需要明确教给 AI：

1. 先看 `skills.list`
2. 再 `ccski info <skill>`
3. 从输出中的真实 path 定位该 skill 目录
4. 如果 skill 列出了 `references/*.md`，只读取当前需要的那几个文件

关键点：

- 这条方法属于全局 system law，不属于某一个 skill 自己解释
- AI 不应该把整个 references 目录一次性读入上下文
- 只在需要的时候顺着真实路径继续展开

### 4. 原子 skill 必须收敛回自己的 system boundary

#### `agenter-terminal`

只讲：

- terminal 的 create/read/write/kill
- terminal vs one-shot bash 的边界
- 长期进程归 terminal
- `write` 不代表成功

不讲：

- 127.0.0.1 / localhost 交付契约
- room message 发送时机
- URL 验证 checklist

#### `agenter-message`

只讲：

- room 读写
- protocol / prefix
- durable truth
- correction / replacement

不讲：

- curl verification
- host binding
- terminal output health

#### `agenter-attention`

只讲：

- obligation / score / commit / done
- 什么时候 obligation 真的完成

不点名具体的 room / terminal / message 出口流程。

#### `agenter-collaboration`

只讲：

- shared-room role boundary
- single source of truth
- correction and ownership

不承接磁盘事实修复、交付验证这类更底层的法则。

#### `agenter-runtime`

保留为 integration entry skill，但仍需收敛：

- direct tools 是什么
- 发现路径是什么
- one-shot bash 与 terminal 的边界是什么

不再承载大段 delivery checklist。

## 结构方案

### Skill layout

每个 skill 目录变成：

```text
<package>/skills/<skill-name>/
  SKILL.md
  references/
    <topic>.md
```

`SKILL.md` 末尾提供短 references 索引，例如：

```md
References:
- `references/terminal-lifecycle.md`: create/read/write/kill strategy
- `references/file-writing.md`: safe multi-line file writing patterns
```

### Prompt updates

在全局 prompt 中补三条 durable law：

- `ccski info` returns the real `SKILL.md` path
- inspect sibling `references/*.md` only when needed
- use shell `cat` / `sed -n` / `ls` to expand one file at a time

### `skills.list` copy update

`skills.list` 头部也补一条轻量说明：

- `ccski info <skill>` shows the real skill path
- if the skill lists references, inspect only the needed sibling files

这不是为了取代全局 prompt，而是让 skill discovery surface 本身也保持一致。

## 风险与应对

### 风险 1：skill 变短后真实 AI 不知道下一步看哪里

应对：

- system prompt 明确教 `ccski info -> path -> references`
- `SKILL.md` 末尾显式列出 references 索引
- `skills.list` 头部提供渐进发现提醒

### 风险 2：把细节挪到 references 只是“换个地方堆文案”

应对：

- 原子 boundary 先收紧，再决定 reference 是否保留
- 底层可靠性缺口不再塞回 terminal/message references
- 需要 verifier 的地方后续单开底层 change 解决

### 风险 3：真实 AI 测试退化

应对：

- 先补 unit tests 锁住结构
- 再跑 real-room-terminal regression
- 重点看模型是否会使用 `ccski info` / `--help` / `cat references/*.md`

## 验证策略

1. skill structure tests
   - `SKILL.md` 包含 concise overview 与 references 索引
   - references 文件实际存在
2. prompt tests
   - 中英 system prompt 都包含 `ccski info -> real path -> references` 指引
3. runtime discoverability tests
   - `ccski info` 仍输出 path
   - `skills.list` 提示渐进发现
4. real AI validation
   - 继续跑 room-terminal real provider flow
   - 检查 AI 是否仍能用新结构完成交付

## 大白话总结

现在的问题不是 skills 太少，而是每个 skill 都在写一本小册子，很多小册子还互相重复。

这次要做的是：

- 把 `SKILL.md` 缩回“这是什么、何时用、第一步怎么做”
- 把更细的材料放到旁边 `references/`
- 再在全局 prompt 里明确告诉 AI：`ccski info` 会给你真实路径，想看细节就顺着路径去 `cat` 指定 reference 文件

这样 skill 才会变成“入口”和“索引”，而不是继续做一个巨大的文本补丁层。
