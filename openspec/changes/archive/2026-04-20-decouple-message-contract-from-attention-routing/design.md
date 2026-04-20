## Context

当前系统里有三套本来应该正交的语义被混在了一起：

1. `message-system` 负责 durable room truth，但 public `rootId` 实际上长期被拿来承载 runtime / cycle 相关锚点。
2. `attention-system` 负责记录 AI 的判断、未完成义务与内部推进，但它仍然保留能直达聊天可见输出的 `message_reply` egress。
3. `session-runtime` 既把房间 unread 工作转成 attention，又保留了 message hook / egress bridge，把“内部想法”和“对外说了什么”混在一条链上。

这导致两类长期问题：

- 消息 contract 不纯：一个看起来像“回复引用”的字段，其实经常在装内部追踪信息。
- revision 逻辑不稳：模型收到 `recentMessages` 后缺少正式 guidance 去按语境判断 edit/recall，而 attention 自动发消息又让“偷偷说了一句”继续存在。

这次 change 明确采用破坏性方案，不考虑向下兼容旧 `rootId` 语义，也不保留 attention 到房间消息的自动桥接。

## Goals / Non-Goals

**Goals:**
- 让 message-system 只保存聊天世界里客观成立的事实。
- 把房间消息引用升级为 first-class `ref`，并移除 `rootId` 这类混合语义字段。
- 删除 attention/message 的自动桥接，让所有可见房间输出都走显式 `message send/edit/recall`。
- 让 `message read` 成为 ref-aware 上下文读取核心，让 `message send` / skill / help 正式教会模型发送后自检与 revision 行为。
- 让 shared transcript 直接渲染引用预览，并客观反映被引用消息的 edit/recall truth。

**Non-Goals:**
- 不保留旧 `rootId` 到新 `ref` 的兼容解释。
- 不在这次 change 里新增新的 attention 外部路由能力替代 `message_reply`。
- 不把聊天引用扩展到跨房间、跨系统或 attention commit 级引用。
- 不在这次 change 里重做整个 message query DSL，只覆盖 ref-aware read / transcript / send guidance 所需最小 contract。

## Decisions

### 1. Message public contract 直接从 `rootId` 切换到 `ref`

消息 world 里只保留“我这条话在接哪条房间消息”这一种引用关系，因此 public type 改为 `ref?: number`，含义固定为“同 chat 内另一条 durable `messageId`”。任何 runtime cycle、attention context、hook id、trace ref 都不得再进入 message record。

物理存储层继续使用现有 `chat_message.ref_id` 列，但它的 durable law 改成只保存 room-local referenced `messageId` 的字符串形式。由于本次不做向下兼容，旧的 runtime anchor 值不再被解释成聊天引用。

Alternative considered:
- 直接保留 `rootId` 并改变注释。
  - Rejected，因为名字和语义已经错位，多轮重构后仍然会继续误用。
- 新增 `ref`，同时保留 `rootId`。
  - Rejected，因为这会把旧残留继续留下，不能真正收口。

### 2. 删除 attention -> message 的自动桥接，而不是继续“更智能”地自动发消息

房间里可见的消息必须来自显式消息动作：

- `message send`
- `message edit`
- `message recall`

attention commit 以后只表达内部事实与待办，不再承载 `message_reply` egress，也不再通过 message hook 根据 summary 自动生成聊天输出。这样“内部思考”和“对用户说的话”在模型与系统两边都变成显式边界。

Alternative considered:
- 保留 `message_reply`，只是不再写 `rootId`。
  - Rejected，因为这仍然保留“attention 自动产出聊天可见事实”的混合模型。
- 继续保留 message hook，但改成读取 `change.value` 而不是 `summary`。
  - Rejected，因为问题不在取哪个字段，而在“自动桥接”本身。

### 3. `message read` 默认解析一层 direct refs

本次把 `message read` 定位为房间语境读取核心。它仍返回时间线 `items`，但新增 `referencedItems` sidecar，用来返回当前窗口消息直接引用到的目标消息。默认只解析一层 direct refs，不递归展开。

这样模型在 `message send` 后看到 recentMessages 可疑时，可以用一次 `message read` 拿到：

- 最近消息
- 它们直接回复的目标消息

从而按语境判断“这是失误重发，还是不同引用上下文下的合法重复”。

Alternative considered:
- 让 `message list` 混入引用解析。
  - Rejected，因为 list 仍应保持目录职责。
- 在 `message send` 结果里直接展开完整引用树。
  - Rejected，因为 send result 应保持轻量，复杂上下文交给 `message read`。

### 4. `message send` / help / skill 明确规定发送后 revision law

仅仅返回 `recentMessages` 不足以让模型稳定学会 revision。需要把发送后自检写成正式 guidance：

1. 发送后查看 `recentMessages`
2. 若最近自己的两条消息高度相似，先 `message read`
3. 结合 direct refs 和对话语境判断是否失误重发
4. 失误重发时优先 `message recall` 或 `message edit`
5. 合法重复时保持原样

这条 law 进入：

- `message send --help`
- built-in `agenter-message` skill
- runtime skill catalog output

Alternative considered:
- 只靠 `recentMessages` 数据，不写 guidance。
  - Rejected，因为这就是当前残留问题的一部分。

### 5. Shared transcript 用 first-class reference preview，而不是 markdown 假装引用

`web-chat-view` 新增 ref lookup/render path：

- transcript row 读 `message.ref`
- 通过当前 items + `referencedItems` 组装 preview target
- 渲染 compact reply preview
- target 被 edit/recall 后，preview 显示对应的客观状态

这保证 WebUI 和其他 host 都使用同一套引用渲染 law，而不是各自手写 blockquote / extra text hacks。

Alternative considered:
- 仅在 operator route 手写引用 UI。
  - Rejected，因为引用关系属于 shared chat surface contract。

## Risks / Trade-offs

- [Risk] 旧 `rootId` 数据会失去原有“看起来还能用”的模糊兼容。 → Mitigation: 这是显式接受的 breaking reset，新的 contract 不再解释旧残留值。
- [Risk] 删除 attention 自动发消息后，某些依赖旧桥接的测试和 workflow 会大面积失效。 → Mitigation: 先补 BDD 回归，统一切到显式 `message send/edit/recall`。
- [Risk] 发送后 revision guidance 仍然依赖模型判断，不能把“相似消息”简化成纯算法 recall。 → Mitigation: `message read` 默认补 direct ref 上下文，让模型按语境判断；测试覆盖合法重复与误重发两类路径。
- [Risk] `message read` 增加 `referencedItems` 后，tool output 体积会上升。 → Mitigation: 默认只解析一层 direct refs，且只返回当前窗口实际引用到的目标消息。

## Migration Plan

1. 先更新 OpenSpec delta specs，明确 message/attention/runtime/web-chat-view 的 breaking contract。
2. 先写 BDD 测试：
   - ref-only message records and reads
   - no automatic attention-visible room message path
   - send/help/skill revision guidance
   - transcript reference preview behavior
3. 实施 message-system / runtime / attention / transcript 改造。
4. 更新 durable specs 与 skill content，跑 targeted verification。

## Open Questions

- None. 本 change 采用默认一层 direct refs 解析，并且不做旧 `rootId` 语义兼容。
