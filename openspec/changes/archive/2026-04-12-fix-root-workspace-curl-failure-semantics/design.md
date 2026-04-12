## Context

在 skills+CLI 架构里，room 交付真相最终依赖 root workspace shell 的 one-shot 验证。AI 已经被教会“先 terminal 启服务，再用 `curl` 验证”，所以当 `curl` 的失败语义不真实时，平台法则本身就被破坏了。

当前 bug 不是提示词问题，也不是 scenario 偶发抖动，而是 shell transport layer 的 contract 有缺口：

1. 服务未监听 `127.0.0.1:<port>`;
2. root workspace `curl` 却返回 `stdout=502`、`exitCode=0`;
3. AI 无法区分“真实 HTTP 502”与“根本没连上”。

## Decision

### 1. 在 shell transport boundary 修，不在 AI 行为层打补丁

这个问题必须在 `root_workspace_bash` 的网络执行边界修复，而不是靠更强的 prompt 去提醒 AI 猜测失败。

原因：

- 交付验证属于平台法则，不应依赖 AI 自己猜 `502` 的含义；
- 只要 shell 层继续伪造成功路径，所有未来 system 都会继承这个错觉；
- 修在 transport boundary，1 user 1 avatar、cold restart、project room 协作都会一起受益。

### 2. 优先保留 built-in curl surface，只修 fetch failure semantics

`just-bash` 已经提供了足够完整的 `curl` 解析与输出能力。问题更可能出在 root workspace 注入的 fetch 行为把连接失败转换成了伪造响应。

因此实现优先级是：

1. 给 root workspace bash 注入一个“truthful fetch”；
2. 成功请求继续返回真实 `status/statusText/body`；
3. 连接拒绝、超时、DNS/transport 失败直接抛错，让 `curl` 走失败分支；
4. 不额外扩大 filesystem/network authority，也不引入新的 direct tool。

这样可以最大限度复用内建 `curl` 的成功路径与常用参数支持，同时修正 dead-port 误报。

### 3. 验证标准以“AI 可判别”为准

修复后的 contract 不是追求完全复刻系统 `curl` 的每个 exit code，而是至少满足：

- dead localhost port 不再返回 `502 + exitCode 0`
- 命令结果必须是非零退出
- 结果面必须保留 AI 可判别的失败信号，最少由 `exitCode` 承担；若命令没有主动静默错误输出，则 stderr 继续保留 transport failure 文本
- live loopback server 仍能返回正常内容

## Validation

- 新增 root workspace curl regression test，覆盖 dead port failure semantics
- 保留并重跑现有 live loopback curl success test
- 重跑 `workspace-system` / `runtime-cli` / `runtime-skills` / `session-runtime.attention-system` 相关测试，确认 shell 面只修 transport law，不破坏 CLI runtime 主路径
