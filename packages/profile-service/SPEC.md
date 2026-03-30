# @agenter/profile-service SPEC

> 本文件记录 `@agenter/profile-service` 的长期职责、系统边界与 durable contract。

## 1. 范围与目标

`@agenter/profile-service` 是 Agenter 的 profile / identity / icon canonical service：

- 管理 canonical profile、identifier binding、public projection 与 metadata
- 管理 email OTP、WebAuthn、wallet proof 这些 ownership/auth flows
- 管理 `profile` / `session` 两类 icon owner 的上传、fallback 与 rasterization
- 既可独立运行，也可由 `app-server` 作为 child service 托管

非目标：

- 不接管 `@agenter/avatar` 的 prompt/persona 目录职责
- 不让 WebUI 或 `app-server` 成为第二套 profile/icon authority
- 不把任意临时字符串直接升级成 durable account

## 2. 身份模型

- durable identity 由 `profile` + `profile_identifier` 组成，而不是“一个 identifier 对应一个 profile”
- 首批 durable identifier family 固定为：
  - `email`
  - `wallet_evm`
  - `wallet_solana`
- `temp` 只用于 public projection / fallback seed，不创建 durable row，除非后续被显式认领
- metadata 写入 canonical profile；任一已绑定 identifier 的读取都必须看到同一份 metadata 与 icon state

## 3. 认证与绑定法则

- email flow 固定为：`OTP start -> OTP verify -> registration ticket -> WebAuthn register/authenticate -> auth token`
- OTP 本身不是 durable bearer；在完成 WebAuthn 之前，只能得到短期 registration ticket
- wallet flow 固定为：`challenge start -> signature verify -> auth token`
- 已认证 profile 追加绑定新 identifier 时，必须重新提交该 identifier 的 fresh proof
- 同一 durable identifier 只能绑定到一个 canonical profile，禁止被第二个 profile 抢占

## 4. Icon 与媒体法则

- icon owner 只允许两类：`profile` 与 `session`
- public URL 语义必须保持分离：profile/avatar 与 session 不能混成一个无类型 bucket
- session fallback seed 属于 profile-service 的 durable fact：`workspacePath + sessionId` 决定图形，`label` 只负责覆盖显示文字符号；调用方不能继续依赖 query 参数临时注入
- Agenter 的 deterministic renderer 必须复用仓库原生的 SVG 随机绘制法则，而不是替换成另一套第三方 identicon 风格；相同 seed 必须持续产出同一视觉身份
- fallback precedence 固定为：
  - `profile`: uploaded asset -> gravatar(仅适用于 email-backed resolution) -> deterministic renderer
  - `session`: uploaded asset -> deterministic renderer
- `profile` 图形 seed 由 resolved identifier 决定
- deterministic renderer 的 canonical source 是 SVG；PNG/JPEG 等 raster variant 必须由服务端通过 `bun:ffi + resvg bridge` 生成
- 默认 icon read 对于 SVG-backed source 也必须返回服务端光栅化后的 raster bytes；只有显式 `format=svg` 才允许返回原始 SVG
- 前端不得再为了“让后端有图可读”而先上传浏览器本地 rasterized fallback

## 5. 存储与运行时法则

- DuckDB 是 durable fact store，负责 profile、identifier、challenge、credential、token、icon asset 等事实
- uploaded icon bytes 在首个切片中直接存入 DuckDB blob，不分裂到第二套 sidecar file authority
- profile-service 作为 single writer 维护 profile/icon/auth 事实；`app-server` 只能做 child-runtime 生命周期管理与 session seed 同步，不得并发写第二份真源
- child-runtime 模式下，`app-server` 负责生命周期与 endpoint 发现；客户端消费 icon/auth URL 时必须直连发现到的 profile-service endpoint。external endpoint 模式下，不得重复 spawn 本地实例
