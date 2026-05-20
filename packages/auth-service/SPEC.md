# @agenter/auth-service SPEC

> 本文件记录 `@agenter/auth-service` 的长期职责、系统边界与 durable contract。

## 1. 范围与目标

`@agenter/auth-service` 是 auth / identity / icon canonical service：

- 管理 canonical auth identity、reference binding、public projection 与 metadata
- 管理 challenge、signature verify、JWT、control-plane claims 这些 auth flows
- 管理 typed icon owner 的上传、fallback 与 rasterization；当前内置 owner 为 `profile`、`session`、`room`、`avatar`
- 管理 `kind: "avatar"` 的 managed principal、公有 avatar metadata，以及 avatar identity 到 icon projection 的 durable contract
- 既可独立运行，也可由 `app-server` 作为 child service 托管

兼容说明：

- `@agenter/profile-service` 只是 legacy alias，不是第二个服务原子
- `profile` 仍是 user/profile projection 与 profile icon owner 的领域名
- 新代码必须导入 `@agenter/auth-service`

非目标：

- 不接管 `@agenter/avatar` 的 prompt/persona 目录职责
- 不让 Studio 或 `app-server` 成为第二套 profile/icon authority
- 不把 Avatar prompt/persona/workspace 行为写回 auth state
- 不把任意临时字符串直接升级成 durable account

## 2. 身份模型

- durable identity 由 canonical auth identity 组成，默认锚定到一个 canonical address / public key
- `email` 等字符串标识在当前法则里只作为 reference metadata 或后续可升级的辅助证明入口，不自动成为并列 durable login identity
- `temp` 只用于 public projection / fallback seed，不创建 durable row，除非后续被显式认领
- metadata 写入 canonical auth identity；reference 读取看到的是同一份 public metadata 与 icon state
- Avatar 是业务角色层，不属于 auth identity 本体
- Avatar 仍然是独立实体，但 durable identity 必须由 AuthSystem mint 成 `kind: "avatar"` principal；`nickname` 只是 owner alias / display field，不是 canonical identity
- avatar principal 的 public metadata 当前最小集合为 `nickname`、可选 `displayName`、可空 `classify`
- 内置 avatar(`default`、`assistant`、`backend`、`architect`、`design`、`frontend`、`ops`、`reviewer`) 的 public metadata 属于 auth-service 的 canonical fact；其 `displayName` / `classify` 不允许由调用方各自推断
- auth-service 启动时必须 reconcile 已存在的内置 avatar metadata，把漂移或缺失的 `displayName` / `classify` 收敛回 canonical built-in profile

## 3. 认证与绑定法则

- 默认登录主链路固定为：`challenge start -> signature verify -> short-lived JWT`
- root auth key 是 app-server 与全局控制面的上游 superadmin 身份来源
- email / WebAuthn 可以作为后续备选能力，但不再是默认主链路
- 已认证 auth identity 追加 reference identifier 时，必须经过显式授权写入，且不得把 reference 提升成并列 durable login identity
- JWT / claim state 属于 private auth facts，不得泄漏到 public projection

## 4. Icon 与媒体法则

- icon owner 采用 typed owner family；当前内置 owner 为 `profile`、`session`、`room`、`avatar`，未来如 `terminal`、`task` 只能以新增明确 owner type 的方式接入，不能回退成无类型 bucket
- public URL 语义必须保持分离：profile/avatar、session、room 与未来 typed owner 不能混成一个无类型 bucket
- session fallback seed 属于 auth-service 的 durable fact：`workspacePath + sessionId` 决定图形，`label` 只负责覆盖显示文字符号；调用方不能继续依赖 query 参数临时注入
- room 与未来 typed owner 的 deterministic seed 来自 owner-specific stable icon seed；调用方不能绕过 typed owner contract 直接拼接一套第二种 fallback 规则
- Agenter 的 deterministic renderer 必须复用仓库原生的 SVG 随机绘制法则，而不是替换成另一套第三方 identicon 风格；相同 seed 必须持续产出同一视觉身份
- fallback precedence 固定为：
  - `profile`: uploaded asset -> gravatar(仅适用于 email-backed resolution) -> deterministic renderer
  - `session`: uploaded asset -> deterministic renderer
  - `avatar`: uploaded asset -> deterministic renderer(principal-seeded background + classify-stable center glyph)
  - `room` 与 future typed owner: uploaded asset -> deterministic renderer
- `profile` 图形 seed 由 resolved identifier 决定
- `avatar` 图形 seed 由 avatar principal / address 决定；`classify` 只决定中心 glyph，不改变 canonical identity
- avatar deterministic renderer 的背景色场只由 avatar principal seed 决定，并以 canonical SVG/HSL color stops 输出；调用方不得再按 nickname、label 或页面上下文重算第二套颜色法则
- avatar deterministic renderer 的中心 glyph 必须只由 canonical `classify` 决定，并复用 Lucide SVG asset；调用方不得手写第二套 classify glyph switch 或页面私有 avatar renderer
- `room` 与 future typed owner 图形 seed 由 owner-specific stable icon seed 决定
- deterministic renderer 的 canonical source 是 SVG；PNG/JPEG 等 raster variant 必须由服务端通过 `bun:ffi + resvg bridge` 生成
- 默认 icon read 对于 SVG-backed source 也必须返回服务端光栅化后的 raster bytes；只有显式 `format=svg` 才允许返回原始 SVG
- 前端不得再为了“让后端有图可读”而先上传浏览器本地 rasterized fallback
- 前端消费 avatar 图像时必须以 auth-service 返回的 `iconUrl` / raster variant 为唯一真源，不得在 Studio、catalog、skills 或其他 feature 内发明第二套 avatar fallback renderer

## 5. 存储与运行时法则

- SQLite 是 durable fact store，负责 auth identity、reference、challenge、credential、token、icon asset 等事实
- 新 auth-service 默认使用 `.agenter/auth-service/auth-service.sqlite`
- uploaded icon bytes 在首个切片中直接存入 SQLite blob，不分裂到第二套 sidecar file authority
- auth-service 在 data dir 内维护显式 startup lock，确保同一个 authority root 同时只有一个 writable runtime
- auth-service 在同一个 data dir 内发布 authority-scoped runtime descriptor，至少包含 `endpoint`、`pid`、`dataDir`、`rootAuthKeyPath` 与 `updatedAt`
- runtime descriptor 只是 authority discovery fact，不是并发写放行器；consumer 复用前必须先确认 descriptor 指向的 endpoint 仍然健康
- auth-service 作为 single writer 维护 auth/icon/public-identity 事实；`app-server` 只能做 child-runtime 生命周期管理、root-auth bootstrap 与 session seed 同步，不得并发写第二份真源
- child-runtime 模式下，`app-server` 负责生命周期与 endpoint 发现；同 authority root 已存在健康 runtime descriptor 时，consumer 默认应复用该 writer 而不是再次启动。客户端消费 icon/auth URL 时必须直连发现到的 auth-service endpoint。external endpoint 模式下，不得重复 spawn 本地实例
