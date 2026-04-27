# @agenter/profile-service SPEC

> 本文件记录 `@agenter/profile-service` 的兼容边界。

`@agenter/profile-service` 是 `@agenter/auth-service` 的 legacy compatibility package。它不得拥有独立服务实现、独立存储真源或第二套 auth/icon authority。

- 新代码必须依赖 `@agenter/auth-service`
- 旧 import 可以通过本包继续获得同一套 auth-service API
- `profile` 仍可作为 profile projection / profile icon owner 的领域名存在
