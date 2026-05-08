# agenter SPEC

> 本文件记录 `agenter` npm 包的长期发布职责。

## 1. 角色

`agenter` 是面向 npm 用户的 public release shell：

- 暴露 `agenter` binary
- 打包 internal `@agenter/cli` 的 launcher / daemon bootstrap 实现
- 保持 workspace 开发态与 npm 发布态的同一命令面

## 2. 长期法则

- public package 是 release surface，不是新的 runtime authority；descriptor-driven launcher law 仍由 internal `@agenter/cli` 实现。
- Bun-first package 的 `bin` / `exports` 必须 ts-first，直接指向 source entry；不得再维护 source-or-dist wrapper 分流。
- public package 只能 externalize unavoidable native/runtime npm dependencies；内部 workspace package 不得作为 published runtime dependency 暴露给消费者。
