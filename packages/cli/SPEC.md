# @agenter/cli SPEC

> 本文件记录 `@agenter/cli` 的长期职责与边界。

## 1. 角色

`@agenter/cli` 是 `agenter` binary 的 product-agnostic launcher 与本机 bootstrap 入口：

- 负责 `daemon`、`auth-service`、`web`、`tui` 等一等入口的启动编排
- 负责 first-party product command descriptor registry 与 launcher env contract
- 负责在需要时确保本机 daemon / auth-service authority 并把上下文传给子进程

## 2. Product Command Launcher Law

- product command 只能通过受控 descriptor 解析到 first-party package；不得把用户输入当成任意 npm package 名执行。
- launcher 只拥有 descriptor lookup、package resolution、stdio/exit propagation、daemon/auth context 注入；不得解析 product grammar，也不得 import product implementation。
- product package resolution 固定遵守 `workspace > installed package > configured remote runner`。
- launcher 创建的 product 进程必须以前台交互模式运行，继承当前 shell-terminal 的 stdio，并传播原始退出码。
- 如果 launcher 为 product command 临时启动了 daemon，则 launcher 负责在 product 退出后清理；若 daemon 先于 launcher 存在，则 launcher 不得接管其生命周期。
