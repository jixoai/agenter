## Context

`root_workspace_bash` 是一个一次性 shell primitive。它适合做真实路径检查、整文件重写、`curl` 验证、`ccski` 查询，但不适合承担“进程活着、后续还能继续 read/write/recover”这种 durable process 语义。

真实 AI 的 multi-avatar project-room 场景里，backend 在 one-shot bash 中尝试用 `node server.js > server.log 2>&1 &` 启动服务。房间里出现了“看似已经交付”的错觉，但最终用户访问拿到 502，说明平台在错误地鼓励 AI 把长期进程塞进一个不可靠的执行面。

## Goals / Non-Goals

**Goals**
- 把“长期进程属于 terminal”提升成平台法则，而不是继续依赖 prompt 习惯
- 让 one-shot bash 在后台化语句出现时立即报错，并给出明确迁移路径
- 保持文件写入、一次性验证、短命命令等 one-shot bash 的现有能力
- 让 AI 在真实 project-room 场景里自然转向 `terminal create` / `terminal write` / `terminal read`

**Non-Goals**
- 不让 one-shot bash 去模拟 durable terminal
- 不在本轮引入新的 shell tool 或 job-control 子系统
- 不试图覆盖 every possible persistence escape hatch，只先收口已知主路径：shell 后台语句

## Decisions

### 1. 用 just-bash AST 做语法级 background 拦截

实现使用 `just-bash.parse()` 解析脚本，并检查 `Statement.background`。

理由：
- 这是 shell 语义级的法则，不是字符串黑名单
- 不会误伤 heredoc 内容里的 `&&`、`&` 文本
- 可以统一覆盖多行脚本，而不是只看最后一行

### 2. 所有 one-shot workspace bash surface 共用同一个 guard

守卫逻辑抽成共享 helper，同时接入：
- `executeRootWorkspaceBash`
- `executeWorkspaceBash`

理由：
- 两者都属于 one-shot shell，不应该出现“一个禁止，一个放行”的法则分裂
- 平台法则应当在原语层统一，而不是只给 model direct tool 打补丁

### 3. 错误信息必须把 AI 推回 terminal 路径

后台化语句被拒绝时，stderr 必须显式告诉 AI：
- one-shot bash 不能稳定托管后台进程
- 持续运行的服务必须用 `terminal create` / `terminal write` / `terminal read`

理由：
- 只报错不引导，AI 仍会重复试错
- 这是系统哲学的一部分：长期进程属于 TerminalSystem，恢复也依赖 TerminalSystem

### 4. Prompt 与 skills 同步强化，但不代替平台约束

`AGENTER_SYSTEM` 与 runtime skills 继续明确：
- `root_workspace_bash` 只做 one-shot 检查/验证
- 需要持续运行的服务必须进 terminal
- 不要在 one-shot bash 里使用 `&`

理由：
- 平台 guard 负责硬约束
- prompt/skills 负责减少 AI 走到错误路径的概率

## Risks / Trade-offs

- [Risk] 某些极少数 shell 技巧可能仍绕过第一版 guard，例如更深层的自定义解释器嵌套
  - Mitigation: 第一版先覆盖顶层与常见 `bash -c` 嵌套；后续根据真实失败证据继续扩充

- [Risk] 某些旧测试或脚本可能依赖 one-shot shell 的后台化行为
  - Mitigation: 这是本轮明确的 breaking law；正确迁移路径就是 terminal

## Validation Plan

1. 补 unit/integration test，验证 one-shot bash 对后台语句直接返回非零与引导 stderr
2. 回跑 `workspace-system.test.ts`
3. 回跑真实 multi-avatar `real-project-room.integration.test.ts`
4. 确认单 Avatar 与冷重启路径没有因为新 guard 回归
