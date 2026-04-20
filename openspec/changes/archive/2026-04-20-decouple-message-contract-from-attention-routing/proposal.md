## Why

当前 message-system 仍然残留多轮 runtime 重构留下的耦合痕迹：房间消息把 `rootId` 当成聊天引用外观却实际承载内部锚点，attention 仍然可以通过 egress / hook 直接生成可见房间消息，而 `message send` / `message read` / message skill 还没有把“发送后自检、按语境决定 edit/recall”的行为收成正式 contract。继续在这套模型上补丁，只会让 message-system 越来越不像一个纯粹的聊天系统。

现在需要一次破坏性收口：让 message-system 只表达聊天事实，attention 只表达 AI 的待办与判断，LoopBus/runtime 只表达后台调度。这样才能把重复发言修正、回复引用、编辑/撤回这些能力建立在“对话语境”上，而不是建立在内部 cycle/egress 残留上。

## What Changes

- **BREAKING** 把房间消息 public contract 里的 `rootId` 完整移除，改成只表达同房间消息引用的 `ref`。
- **BREAKING** 移除 attention 到可见房间消息的自动路由能力，包括 `message_reply` egress 和基于 attention summary 的 message hook 自动发消息。
- 升级 `message read` 为 ref-aware 读取入口，默认返回一层 direct refs 的 sidecar 消息，供模型按语境判断是否 edit/recall。
- 升级 `message send`、`message send --help` 和内置 message skill，使发送后检查 recentMessages、必要时 `message read`、再决定 `edit/recall` 成为正式 guidance。
- 在 shared chat transcript 中新增 first-class reply preview，且被引用消息的 edit/recall 状态能客观反映到预览里。
- 补齐 BDD 回归，覆盖 ref-only 消息 contract、attention 不再自动出现在聊天里、以及基于语境的 message revision 路径。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `message-chat-control-plane`: durable room messages 改为只支持客观聊天事实与同房间 `ref`，不再暴露 runtime/attention 锚点。
- `message-hook-bridge`: 删除 attention summary 自动发可见房间消息的桥接能力。
- `attention-egress-routing`: attention commit 不再承载房间消息可见输出路由。
- `session-runtime-attention-message`: runtime 保留“房间输入 -> attention”的路径，但房间可见输出必须走显式 message mutations。
- `runtime-json-tool-descriptor-surface`: `message read` / `message send` / `attention commit` 的 schema、help、skill guidance 改为显式 ref-aware / revision-aware contract。
- `web-chat-view`: transcript 渲染 first-class message references，并客观同步被引用消息的 lifecycle。

## Impact

- `packages/message-system/src/*`
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/runtime-tool-descriptors.ts`
- `packages/app-server/src/runtime-tool-views.ts`
- `packages/attention-system/src/*`
- `packages/web-chat-view/src/*`
- `packages/app-server/test/*`
- `packages/web-chat-view/test/*`
- `openspec/specs/message-chat-control-plane/spec.md`
- `openspec/specs/message-hook-bridge/spec.md`
- `openspec/specs/attention-egress-routing/spec.md`
- `openspec/specs/session-runtime-attention-message/spec.md`
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
- `openspec/specs/web-chat-view/spec.md`
