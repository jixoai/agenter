# @agenter/auth-cli SPEC

> 本文件记录 `@agenter/auth-cli` 的长期职责与边界。

## 1. 角色

`@agenter/auth-cli` 是 `auth-service` 的 endpoint-oriented operator client：

- 面向任意 auth-service endpoint 发起认证、查询、metadata 变更与 icon 上传
- 复用服务端公开 contract，而不是直接读写服务端本地存储
- 作为简易后台/运维入口，替代重量级 web admin

兼容说明：

- `@agenter/profile-cli` 与 `profile-cli` binary 只是 legacy alias
- profile projection 相关命令名仍可使用 `profile-*`，因为它们操作的是 profile domain object

## 2. 边界

- CLI 不持有 canonical auth/profile state；auth-service 永远是真源
- CLI 输出必须直接反映服务端 projection / challenge / ticket / token 结果，不做二次业务解释
- email flow 只负责触发 OTP start / verify 与后续 WebAuthn URL 消费，不把 OTP 本身当成持久登录态
- CLI 面向的永远是 auth-service 自身 endpoint；如果 endpoint 来自 app-server 的 child-runtime 发现结果，CLI 也不经过 app-server 媒体/认证代理
