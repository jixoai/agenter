# @agenter/profile-cli SPEC

> 本文件记录 `@agenter/profile-cli` 的兼容边界。

`@agenter/profile-cli` 是 `@agenter/auth-cli` 的 legacy compatibility package。它只保留 `profile-cli` binary 和旧 import 入口，并委托到同一个 auth-cli runner。

- 新脚本默认使用 `auth-cli`
- 旧 `profile-cli` binary 继续可用
- profile projection 相关命令名可以继续表达领域对象，不代表 CLI package 仍是 canonical
