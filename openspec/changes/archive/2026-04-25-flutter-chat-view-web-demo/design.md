## Context

`packages/flutter-chat-view` 原先只是一个 docs-only 占位包，旧文档里还保留了过时的 `/chat/$CHAT_ID` transport 假设。与此同时，message-system 与 `web-chat-view` 已经收敛到 room-first contract，真实入口是授权后的 room websocket，附件上传也走独立的 room asset HTTP API。当前用户要求第一阶段不要污染 `packages/webui`，只提供一个可以通过 `url + token` 访问的独立 demo 链接，因此这次实现必须一边把 Flutter 侧 contract 校准到 canonical room law，一边把交付面限制在独立 Flutter Web demo。

这个 change 跨越了 package public surface、demo shell、transport parsing、attachment upload、OpenSpec durable docs，因此需要先把架构决策固化，而不是继续让实现漂浮在示例代码之上。

## Goals / Non-Goals

**Goals:**
- 把 `packages/flutter-chat-view` 从文档占位升级为可编译、可测试的 Flutter package。
- 建立 renderer-neutral 的 controller / model / merge / plugin law，让后续 Android、iOS、macOS 只复用规则，不复用 Web glue。
- 交付独立 Flutter Web demo，并允许通过配置面与 query parameters 输入 `url + token`。
- 对齐 canonical room transport、reverse paging、message revision merge、room asset upload contract。
- 明确 phase 1 不依赖 `packages/webui`。

**Non-Goals:**
- 不在本次 change 中嵌入或修改 `packages/webui`。
- 不做 Android、iOS、macOS 的原生打包与平台适配。
- 不实现完整的 production-grade virtualization、rich media preview、screenshot runtime delegate。
- 不引入新的后端 transport 或替换现有 message-system / room asset API。

## Decisions

### Decision: 先建立 Flutter 侧的“规则内核”，再做具体宿主壳层

`ChatViewController`、`ChatViewState`、transport parser、message merge、composer plugin contract 构成 package 的平台法则；`FlutterChatView` 和 `example` 只是规则的一个宿主投影。这样后续无论是 Flutter Web demo、原生壳层，还是未来嵌入其他前端容器，都不需要重新发明 transport lifecycle。

Alternatives considered:
- 直接在 `example` 里堆业务逻辑：会把 transport / upload / merge 法则绑死在 demo 壳层里，后续平台迁移只能复制粘贴。
- 先做纯 widget、以后再补 controller：会导致每个宿主都各自管理 transport，破坏正交边界。

### Decision: Phase 1 交付独立 demo，而不是 WebUI embed

独立 demo 是当前最纯的 Web 运行时，也是用户明确要求的第一阶段边界。它只需要 room websocket 与 room asset upload 两个 canonical backend surface，就能验证 Flutter 端的可移植性；如果现在把 demo 塞进 `packages/webui`，会把 transport 验证和 WebUI 宿主耦合到一起，既污染现有稳定面，也会掩盖 Flutter package 自身的边界问题。

Alternatives considered:
- 直接加 `webui` route：交付看似更快，但会把 demo 的访问、状态和布局法则混进现有 Svelte shell，削弱未来跨平台可移植性。
- 只做本地 example、不支持 link：无法满足“只提供 demo 链接”的访问诉求。

### Decision: `url + token` 作为宿主配置真源

demo 与 controller 统一以 room transport URL 为配置真源，再从该 URL 推导 room id 与 HTTP base URL；可选 token 负责覆盖或补充 websocket query token，并复用于 room asset upload header。这避免了 host 额外提供 `chatId + apiBase + wsBase + token` 的多参数胶水配置。

Alternatives considered:
- 单独要求 host 传 `chatId`、`httpBase`、`wsBase`：会产生不必要的配置组合与失配风险。
- 完全相信 transport URL 自带 token：不利于 demo link 重配，也不利于 operator 手动替换 room access token。

### Decision: 附件上传保持独立 HTTP law，不伪装成 websocket 能力

message-system 的 room attachments 真实语义是“先上传 room-owned assets，再在消息里引用 metadata”。Flutter controller 因此必须先打 `POST /api/rooms/{chatId}/assets`，拿到 attachment metadata 后再发 websocket `send` frame，而不是把本地文件直接塞进 websocket send payload。

Alternatives considered:
- 在 websocket `send` 中直接发送文件：不符合 canonical backend contract。
- 把上传逻辑留给 demo 壳层：会让 package 失去跨平台可复用的 send law。

### Decision: composer 扩展采用显式 trigger plugin contract

`@`、`/`、`$`、附件和截图属于独立原子，不应作为 if-else 分支写死在 composer 核心中。当前 package 用 `ChatComposerPlugin` 描述“触发字符 + suggestion resolution”，demo 只安装 `StaticSuggestionPlugin` 作为占位插件。这样后续可以在不污染核心 composer 的前提下接入真实 path picker、command palette、skills picker、screenshot delegate。

Alternatives considered:
- 在 composer 内硬编码 mentions/commands/skills：短期简单，但违反平台法则优先。
- 一次性引入完整插件运行时：超出本次 phase 1 范围。

### Decision: 不引入第三方全家桶 chat kit

本次需求的关键不是“快速拼一个 Flutter 聊天 UI”，而是“对齐 Agenter 自己的 message-system contract”。现成 chat kit 往往自带自己的 message model、attachment flow、composer assumptions 和 paging semantics，会迫使我们围着第三方库写胶水层。当前采用 Flutter primitives + 自定义 controller/model/widgets，更容易保持 durable contract 的一元所有权。

Alternatives considered:
- 使用 `flutter_chat_ui` / `dash_chat_2` 等整包方案：交互上能更快起步，但协议与数据模型并不正交，长期维护成本更高。

## Risks / Trade-offs

- [Risk] 当前 transcript 还是 `ListView`，长历史性能与精准 anchored scrolling 还不够强。 → Mitigation: 把 merge / reverse paging / visible message facts 先抽成独立法则，后续再替换具体滚动 primitive。
- [Risk] demo link 会把 access token 暴露在 URL 中，适合开发/内部验证，不适合公网生产分发。 → Mitigation: 在设计与 README 中明确这是 phase 1 demo contract，不把它当生产认证入口。
- [Risk] screenshot plugin 目前只有 command shell，没有真实 delegate。 → Mitigation: 把 delegate 保持为可注入接口，缺席时只退化为无能力状态。
- [Risk] package 先服务 Web demo，视觉和交互细节还不是最终跨平台收口形态。 → Mitigation: 坚持 controller/model/plugin 正交，把平台差异留在宿主层。

## Migration Plan

1. 补齐 OpenSpec proposal / specs / design / tasks，锁定本次变更的 durable contract。
2. 继续完善 `packages/flutter-chat-view` 的 public package surface、测试与 analyzer 清洁度。
3. 保持 demo 入口只在 `packages/flutter-chat-view/example`，并支持 query-parameter link。
4. 验证 `flutter test` 与 `flutter analyze` 在 package 和 example 维度通过。
5. 更新 package README / DESIGN / AGENTS / durable spec，让仓库真源与实现一致。

Rollback strategy:
- 如果 demo 形态需要回退，只回退 `packages/flutter-chat-view` 与对应 OpenSpec change；由于没有碰 `packages/webui`，不会影响现有 WebUI 路径。

## Open Questions

- phase 2 是否需要把 room token 从 query parameter link 改成仅 session storage / local form 输入，避免 demo link 暴露敏感参数。
- phase 2 的 transcript 是否直接切换到 Flutter 侧虚拟滚动 primitive，还是先把 anchored scroll contract 再抽象一层。
- screenshot、path picker、skills picker 的真实 provider API 应该直接放进 plugin contract，还是在 controller 上再定义 service delegate。
