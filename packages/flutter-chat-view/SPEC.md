# flutter-chat-view SPEC

> 本文档只记录 `packages/flutter-chat-view` 的长期 Flutter-side contract。

## 1. Package ownership

- `flutter-chat-view` 是 Agenter room chat surface 的 Flutter package，不是 `packages/webui` 的兼容层。
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
- 这个阶段禁止把产品壳直接嵌进 `packages/webui`。
- example 壳层必须遵守三态布局法则：`compact < 720`、`standard 720-1099`、`expanded >= 1100`。
- example 壳层必须默认携带本地化、基础无障碍语义与键盘捷径，不把这些能力延后到 native phase 才补。
- 后续 Android、iOS、macOS 只应复用本 package 的规则内核，不应复制 Web demo glue。
