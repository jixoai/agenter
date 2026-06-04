# agenter SPEC

> 本文件记录 `agenter` npm 包的长期发布职责。

## 1. 角色

`agenter` 是面向 npm / Homebrew 用户的 public wrapper shell：

- 持有 `agenter` command name 与固定 public bin path
- 解析当前 host 到一个显式 `@jixoai/cli-*` 平台包
- 在正常运行路径上把控制权交给 compiled native CLI，而不是把 source entry 暴露给终端用户
- 保持 launcher / daemon bootstrap source authority 仍然属于 internal `@agenter/cli`

## 2. 长期法则

- public package 是 release surface，不是新的 runtime authority；descriptor-driven launcher law 仍由 internal `@agenter/cli` 实现。
- public package 必须是 wrapper-first：它通过 `optionalDependencies`、固定 bin placeholder、postinstall/fallback projection 暴露 host-native runtime，而不是继续把 ts/source entry 当成 public install law。
- public package 可以在 install 或 fallback 阶段使用 Node，但正常 `agenter ...` 运行路径必须执行 host-native compiled binary；operator 不需要手动管理 Bun。
- GitHub release binary archives 是 public install surface 的 canonical binary truth；npm wrapper 与 Homebrew formula 都只能消费这份 truth，不得各自产生第二份独立编译结果。
- internal workspace package 不得直接作为 published runtime dependency 泄漏给终端用户；允许公开暴露的只有 wrapper 自身与显式平台二进制原子。
