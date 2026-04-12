## 背景

当前 built-in runtime skills 的实现同时违反了两条底层法则：

1. 原子系统没有 owning source
   - `agenter-attention` 的内容写在 `app-server`
   - `agenter-message` / `agenter-terminal` 也是同样
   - 包本身无法在自己的边界内维护自己的 AI-facing contract
2. 平台文档污染了 Avatar 私有空间
   - runtime boot 时会把 built-in skills 写入 `<rootWorkspace>/skills`
   - 这让平台内置法则与用户/Avatar 自己生产的 skill artifact 混在一起

这不是“文案放哪儿更舒服”的问题，而是 ownership model 已经不清晰：文件夹就是隔离空间，私有空间里不应该被平台静默塞入一堆系统自带说明书。

## 目标

- 让每个系统在自己的 package 内拥有自己的 skill source
- 让 runtime 通过聚合产物消费 built-in skills，而不是在启动时向 Avatar root workspace 写文件
- 保持 `ccski list/info/search`、`skills.list`、real AI discoverability 继续可用
- 保留 runtime slot 注入能力，但把它收敛成简单、可审计的模板替换

## 非目标

- 不改 workspace public/private asset root 的业务能力
- 不把用户/Avatar authored skills 迁移为 package source
- 不引入复杂的 skill DSL、数据库或二次索引系统
- 不为旧的 built-in skill 文件写兼容迁移层

## 新的平台法则

### 1. Package-owned skill source 是唯一真源

每个 runtime-facing built-in skill 必须放在 owning package 的 `skills/**/SKILL.md`：

- `packages/attention-system/skills/attention/SKILL.md`
- `packages/message-system/skills/message/SKILL.md`
- `packages/terminal-system/skills/terminal/SKILL.md`
- `packages/app-server/skills/runtime/SKILL.md`
- `packages/app-server/skills/workspace/SKILL.md`
- `packages/app-server/skills/collaboration/SKILL.md`

`name` / `description` 等 discoverability 元信息仍然放在 frontmatter 中，目录只是 package 内部组织方式，不是 runtime contract。

### 2. Build aggregation 负责把 package-owned source 投影成 runtime catalog

新增一个 builder：

- 扫描 `packages/*/skills/**/SKILL.md`
- 解析 frontmatter 与正文模板
- 生成 `packages/app-server/src/generated/runtime-skill-catalog.generated.ts`

生成物至少包含：

- skill `name`
- `summary`
- `sourcePath`
- `packageName`
- 原始模板正文

runtime 消费 generated catalog，而不是每次自己重新爬整个 repo。这样 source ownership 和 runtime loading 被解耦：

- source 归 owning package
- runtime loading 归 app-server

### 3. Runtime slot 只允许做轻量模板展开

package-owned `SKILL.md` 允许使用少量 runtime slot：

- `{{runtime.root_workspace_path}}`
- `{{runtime.principal_id}}`
- `{{examples:<namespace>.<subcommand>}}`

这些 slot 由 `runtime-skills.ts` 在读取 built-in skill 时展开。

限制：

- 只做字符串或整段 example 的纯函数替换
- 不允许任意脚本执行
- 不允许把复杂业务逻辑重新塞回 skill 模板

这样既保留了“示例跟 descriptor 同步”的能力，也避免回到过去那种大 `switch` 里手写整篇文档。

### 4. Built-in catalog 与 on-disk user skills 是两个 ownership domain

runtime `ccski` discoverability 需要同时看两类来源：

1. built-in catalog
   - package-owned
   - 只读
   - 不属于 Avatar root workspace asset
2. on-disk skills
   - `~/.agents/skills`
   - `~/.agenter/skills`
   - `<rootWorkspace>/skills`
   - 属于共享/全局/Avatar 自己的 durable asset

合并策略：

- built-in catalog 先进入列表，作为最低优先级 baseline
- shared/global/avatar on-disk skills 可以覆盖同名 built-in entry

这样可以继续支持用户在自己的空间里覆写或扩展 skill，同时不再让平台去写入这些目录。

## 模块分层

### 平台法则层

- `runtime-skill-catalog-builder.ts`
  - 扫描 package-owned source
  - 解析 frontmatter
  - 生成稳定 catalog 数据
- `scripts/build-runtime-skill-catalog.ts`
  - 把 builder 输出写入 generated module
- `runtime-skills.ts`
  - 合并 built-in catalog 与 on-disk roots
  - 渲染 runtime slot
  - 提供 `ccski list/info/search` 所需的 discoverability API

### 原子实现层

- 各 package 下的 `skills/**/SKILL.md`
  - 只维护本系统的说明与语义
- `runtime-tool-descriptors.ts`
  - 继续作为 example slot 的唯一真源

## 关键设计细节

### 为什么不继续把 built-in skills 写进 root workspace

因为 `<rootWorkspace>/skills` 是 Avatar 自己的私有空间，不是平台 bootstrap cache。

如果平台每次 runtime boot 都往这里写文件，会带来三个副作用：

- ownership 被污染：文件明明是平台内置，却看起来像 Avatar 私有资产
- future alias / symlink 策略会变复杂：用户无法区分哪些是自己写的，哪些是系统塞的
- 破坏正交性：改一条系统法则就要去改运行时文件副作用

所以 built-in skills 只能留在 package-owned source + generated catalog 这一侧。

### 为什么要 generated catalog，而不是 runtime 直接扫 repo

直接扫 repo 看似简单，但会把 runtime 与源码布局硬绑定：

- runtime 每次启动都要知道 repo 结构
- future bundle / publish 场景会变脆弱
- 测试里很难区分“source 是否存在”和“runtime 消费 contract 是否稳定”

generated catalog 的价值在于：

- source 结构可以演化
- runtime 只依赖稳定的 generated module
- 单测可以单独验证 builder 输出与 runtime 渲染

### 为什么只做少量模板 slot

如果把 runtime slot 做成开放 DSL，很快又会回到“技能文档里藏业务逻辑”的老路。

所以这次只允许三类 slot：

- root workspace path
- principal id
- descriptor-backed examples

这些都是当前真实需要的最小集合，既够用，也能保证模板是纯文本为主。

## 风险与应对

### 风险 1：generated catalog 过期

应对：

- 增加 builder 单测
- 增加 generated-vs-source freshness 测试
- 提供明确脚本用于重建 generated module

### 风险 2：真实 AI 发现路径退化

应对：

- 保持 `skills.list` 的前导摘要不变
- `ccski info <skill>` 仍然返回完整展开后的技能正文
- 真实 AI 集成测试里继续检查模型是否会主动调用 `ccski info` / `--help`

### 风险 3：用户 on-disk skill 与 built-in 同名冲突

应对：

- 明确 precedence：built-in 最低优先级，on-disk 覆盖 built-in
- 单测覆盖同名覆盖行为

## 验证策略

1. Builder 单测
   - 能扫描 package-owned `skills/**/SKILL.md`
   - 能生成稳定 catalog entry
2. Runtime skill 单测
   - built-in skills 可在不写入 root workspace 的情况下被列出
   - runtime slot 会正确展开
   - on-disk skill 可覆盖同名 built-in
3. 真实 AI 集成测试
   - 继续运行 room + terminal 真实交付链路
   - 检查 bash 调用里 `ccski info` / JSON CLI 的实际使用情况

## 大白话总结

以前的做法相当于：

- 说明书都放在一个中央仓库里
- 每次 Avatar 启动，再偷偷把这些说明书复制进它自己的抽屉

这会把“系统自带规则”和“这个 Avatar 自己存的东西”搅在一起。

这次要做的就是把说明书还给各自的系统包自己保管，再统一编成一本只读目录给 runtime 查。Avatar 自己的抽屉只放它自己的东西，不再混入平台文档。
