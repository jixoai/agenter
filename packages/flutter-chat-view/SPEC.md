# flutter-chat-view SPEC

> 本文档只记录 `packages/flutter-chat-view` 的长期 Flutter-side contract。

## 1. Package ownership

- `flutter-chat-view` 是 Agenter room chat surface 的 Flutter package，不是 `packages/studio` 的兼容层。
- package 负责 Flutter 侧的 controller、model、message merge、composer plugin contract 与基础 widgets。
- package 一次只绑定一个 room transport；room durability、ACL、message truth 与 room assets 仍由 `message-system` / app-server 持有。

## 2. Transport contract

- canonical websocket endpoint 是 `ws(s)://HOST[:PORT]/room/<chatId>?token=<accessToken>`。
- server events 固定为 `snapshot`、`messages`、`page`、`focus`、`error`。
- client actions 固定为 `send`、`edit`、`recall`、`page`、`focus`。
- host 以 `transportUrl + optional accessToken` 配置 controller；controller 从 transport URL 推导 room id 和 HTTP base URL。

## 3. Attachment contract

- room attachments 不是 websocket 文件上传。
- Flutter controller 必须先调用 `POST /api/rooms/{chatId}/assets`，并带 `x-agenter-room-access-token` header 上传文件。
- websocket `send` frame 只能发送 server 返回的 attachment metadata，不能发送本地文件句柄或自造 asset schema。

## 4. Transcript contract

- transcript merge identity 优先使用 durable `messageId`，没有 durable id 时才回退到 local `viewKey`。
- edited / recalled room messages 必须原位更新同一条 transcript row，不能追加伪造“修正消息”。
- recalled message 的可见文本必须是 objective recalled state，而不是旧正文残留。
- chat stage 必须允许 host shell 拥有外层 chrome；package 不再强占页面级 header。
- transcript 需要保留产品级 affordance，例如时间分隔、message selection、return-to-latest，而不把这些行为留给宿主用胶水补丁实现。
- 进入非空 transcript 时必须一次性贴底显示最新消息；只有 operator 仍接近最新边缘时，新消息才允许自动跟随到最新。
- 当 operator 向上滚动接近 transcript 顶部且 `hasMoreBefore` 为真时，stage 必须通过 `ChatViewController.requestOlderPage` 发起 canonical `page` action，并在 older page 合并后保持当前阅读锚点。
- return-to-latest 必须是 lifecycle-safe 的 transcript affordance；点击、重复点击、viewport 变化或动画期间 dispose 都不能触发 Flutter render tree 断言。
- transcript row selection semantics 必须由稳定 row atom 显式声明，虚拟列表内的 gesture recognizer 不得额外生成会随滚动销毁的语义节点。
- transcript 与 Web demo shell 禁止挂载 `SelectableRegion` / `HtmlElementView` / Flutter Web platform view；消息复制能力由稳定 message action 承担，不能依赖浏览器嵌入式选择区域。

## 5. Extension contract

- composer 扩展必须通过显式 plugin contract 暴露，不能把 mentions / commands / skills 写死在核心 composer 中。
- 当前 trigger 类别包括 `@`、`/`、`$`；attachments 与 screenshot 属于同一扩展边界的宿主能力。
- screenshot 能力必须保持为可注入 delegate；没有 delegate 时只表现为缺席能力，不能伪造本地实现。

## 6. Localization and accessibility contract

- package widgets 必须通过 package-owned localizations delegate 提供可翻译文案，不能把面向用户的硬编码英文继续留在 model/controller 真源里。
- transcript、composer 与 selection affordance 必须默认暴露基础语义树与键盘可达性，不依赖宿主额外补胶水才能被 Web assistive tech 消费。
- recalled / edited / retry / empty-state 这些 durable UI 状态必须在 widget 层本地化，而不是把翻译后的文案写回 room model。

## 7. Delivery boundary

- phase 1 的 operator-facing delivery 是 `packages/flutter-chat-view/example` 独立产品壳。
- 这个阶段禁止把产品壳直接嵌进 `packages/studio`。
- example 壳层必须遵守三态布局法则：`compact < 720`、`standard 720-1099`、`expanded >= 1100`。
- compact active conversation 必须是 conversation-first route：底部归 transcript/composer，不允许持久 profile/chat/details bottom nav。
- profile directory、room facts、participants、selected-message facts 必须通过二级/三级 route surface、sheet、popover/menu 或 persistent inspector projection 进入，而不是作为 compact peer tabs。
- compact 二级/三级 route sheet 必须通过语义 detent 表达：profile directory 使用 page detent，room/message inspector 使用 inspector detent；feature code 不允许传散落的 raw height。
- icon-only product-shell action 必须由统一 primitive 暴露单一带本地化 label 的语义 button，并保留至少 `44x44` 命中区域，不能在 Web 语义树里产生额外 unlabeled duplicate button；同一 label 还必须提供 tooltip / long-press help，但 tooltip 不得生成第二个语义 button。
- example 壳层必须默认携带本地化、基础无障碍语义与键盘捷径，不把这些能力延后到 native phase 才补。
- 后续 Android、iOS、macOS 只应复用本 package 的规则内核，不应复制 Web demo glue。
