# @agenter/just-bash-overlay-rule-fs SPEC

> 本文件记录 `@agenter/just-bash-overlay-rule-fs` 的长期职责与公共 contract。

## 1. 范围与目标

`@agenter/just-bash-overlay-rule-fs` 是 WorkspaceSystem 的规则文件系统原语：

- 面向 `just-bash` 的 `IFileSystem` contract
- 在一个真实 root authority 上执行 ordered glob rules
- 支持 dynamic rule refresh，而不是靠销毁并重建 filesystem instance
- 负责共享 public roots 与当前 avatar private roots 的组合暴露

非目标：

- 不接管 workspace mount lifecycle
- 不负责 room / terminal / attention 的业务语义
- 不把 UI 文案或 route 选择写进权限层

## 2. Durable Contract

- filesystem authority 以一个真实 root path 为锚点，所有规则都围绕这一个 authority 计算
- grant 语义固定为：
  - default deny
  - ordered rules
  - last-match-wins
  - directory traversal only reveals still-traversable children
- host 可以为同一个 real root 提供不同 exposed mount path；可见路径样式变化不得改变规则语义
- rule config 必须支持运行时更新，且不要求 caller 重建同一个 mounted filesystem instance
- sibling avatar private roots 的隔离属于 filesystem 自己的职责；`read/stat/readdir` 都必须统一执行隐藏或拒绝

## 3. 集成边界

- WorkspaceSystem / root workspace shell / future shell surfaces 都只能通过 package export 使用这层规则能力
- 业务系统如果要调整 grants、hidden paths 或 exposed mount roots，应通过配置输入驱动，不得 fork 一套平行权限实现
