# @agenter/cli-shell SPEC

> 本文件记录 `@agenter/cli-shell` 作为外部产品包的长期职责。

## 1. 角色

`@agenter/cli-shell` 是 ordinary-user terminal product：

- 通过 `agenter shell` 被 descriptor-driven launcher 启动
- 把一个 user shell-terminal 绑定到一个 backend terminal、一个 product room、一个 selected AvatarRuntime
- 在不污染 core runtime 的前提下提供 bottom-only TUI、chat dialogue、managed hosting surface

## 2. 长期法则

- package 只能通过 `@agenter/client-sdk` 与 `@agenter/product-extension-runtime` 消费平台能力；不得 import core runtime internals。
- optional `@avatar` 与 `--session` grammar 属于 product-local parsing：Avatar identity 与 shell name 必须分离，shell name 不能成为 runtime identity。
- 默认 assistant 是 `shell-assistant`；其 prompt 与 memory 初始化固定为 seed-if-missing，且底层 avatar-private 文件保持开放可编辑。
- cli-shell 的 room、terminal、heartbeat、managed state 都必须读取 backend / platform truth；local process memory 不能冒充 reconnect 后的 canonical state。
- managed mode 只是 hosting attention + write-capable delegation projection；positive `hosting` 不等于隐式 terminal write privilege。
- TUI 的第一原则是 terminal-first：默认只占用一行底部 toolbar，显式对话面板是附加 view state，不得退化成多 terminal dashboard。
