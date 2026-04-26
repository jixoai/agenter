# 2026-04-26 terminal lifecycle + config surface changelog

## 这次到底改了什么

这次不是在 terminal 上继续打补丁，而是把 terminal 的两种 truth 分开了：

1. durable truth
   - `processPhase`: `not_started | running | stopped`
   - 这是 terminal 真实持久状态，应该能写进 catalog，也应该能被 CLI / runtime / WebUI 长期读取

2. transient coordination truth
   - `lifecycleTransition`: `bootstrapping | killing | null`
   - 这不是“又一种业务状态”，只是并发协调锁
   - 作用是防止多个 Avatar 同时对一个 terminal 重复 bootstrap / stop / delete / set-config
   - 它不会自己制造 terminal attention debt

大白话就是：

- `running/stopped` 说的是“这台终端现在客观上是什么状态”
- `bootstrapping/killing` 说的是“现在有人正在动它，先别同时再动”

## terminal-system 内核改动

- `TerminalControlPlane` 现在显式维护 `lifecycleTransition`
- `bootstrap / stop / delete / set-config` 都会先检查 transition 锁，避免重叠修改
- 新增 `getTerminalConfig` / `setTerminalConfigAuthorized`
- `set-config` 是 patch 语义，不是整对象覆盖
- running PTY 上只有 `cols/rows` 会 live apply
- `command / launchCwd / env / processKind / gitLog / logStyle` 这类 launch truth 改的是“下次 bootstrap 的真相”
- `ManagedTerminal.reconfigure(...)` 现在能更新 durable launch config
- `ManagedTerminal.resize(...)` 现在会同步刷新本地 snapshot geometry，不再出现“已经 resize 了，但读出来还是旧 rows/cols”的错觉

## runtime / app-server 改动

- runtime local API 新增：
  - `terminal get-config`
  - `terminal set-config`
- `session-runtime` 已经把 `lifecycleTransition` 接进 snapshot / runtime event / terminal status projection
- `app-kernel` 现在会把 terminal `transition` 当成 catalog change 广播出去，前端能及时看到
- 但 transition 只是 surface truth，不会被塞进 terminal adapter 变成新的 attention commit

大白话就是：

- 现在 CLI / runtime / WebUI 能看到 terminal 正在 bootstrapping / killing
- 但 LoopBus 不会因为“有人正在停 terminal”就误以为“AI 又有一条新待办”

## terminal skill / 帮助信息改动

- `agenter-terminal` skill 已经补上：
  - `terminal create` 默认 auto-bootstrap
  - `terminal list` 看 observed/runtime truth
  - `terminal get-config` 看 durable launch truth
  - `terminal set-config` 改 durable launch truth
  - `lifecycleTransition` 出现时要等待，不要叠加 mutation
- 新增 reference:
  - `references/terminal-config.md`
- `terminal create/bootstrap/set-config` 的 `--help` 已经补了新的 law

## 测试与真实 AI 走查

这次实际做过的验证：

- `packages/terminal-system/test/control-plane.test.ts`
- `packages/app-server/test/runtime-cli.test.ts`
- `packages/app-server/test/runtime-skill-guidance.test.ts`
- `packages/app-server/test/runtime-skills.test.ts`
- `packages/app-server/test/runtime-tool-views.test.ts`
- `packages/app-server/test/runtime-terminal-kernel-adapter.test.ts`
- `packages/app-server/test/runtime-system-kernel-adapters.integration.test.ts`
- `packages/app-server/test/session-runtime.attention-system.test.ts`
- `packages/app-server/test/real-terminal-skill.integration.test.ts`

真实 AI 结果：

- real terminal skill learning test 已通过
- 说明真实模型确实会先读 `agenter-terminal`，再执行 `terminal list/stop/bootstrap/write`
- 说明 skill 学习链路没有被这次 lifecycle/config surface 改坏

## 最后一轮收口补充

后面又补了一轮“收边”工作，重点不是新功能，而是把外围契约和测试世界彻底对齐：

- 清掉了 `packages/app-server` 显式 `tsc` 的残留
  - 旧 `commit.egress` 调试脚本改成当前 truth 的 `commit.target`
  - `RuntimeLocalApiHandlers` 的 terminal/skill mock handler 全部补齐
  - workspace / message / terminal 的测试夹具改成当前 runtime public view 结构
- 修了 mock LoopBus relay 测试世界
  - mock model server 现在能识别 `message read/edit/recall`
  - `message read` 结果改按当前 CLI shape 解析 `snapshot.channel.chatId`
  - mock relay 不再为了“知道目标房间存在”先执着做旧式 pre-read，而是更符合当前 law：知道 `visibleRooms` / `message list` 结果后就可以先发 relay，再通过 read 追踪后续回复
- 修了 app-kernel transport 测试的时序
  - 之前把 bootstrap 过渡期、live output、进程退出三段时序混在一起断言，导致把合法的 lifecycle catalog change 误报成 transport 回归
  - 现在只观察“terminal 仍在运行时”的 live transport 段，再断言这段期间没有错误的 `catalogChanged`
- 收紧了 `trpc-router` 临时目录清理时机，降低高负载并跑时的异步落盘竞争

## 现在的收口状态

`openspec validate upgrade-terminal-lifecycle-and-config-surface --strict` 已通过。

这次最终确认通过的额外验证：

- `node .../typescript/bin/tsc --noEmit -p packages/app-server/tsconfig.json`
- `openspec validate upgrade-terminal-lifecycle-and-config-surface --strict`
- `packages/app-server/test/agenter-ai.test.ts`
- `packages/app-server/test/app-kernel.test.ts`
- `packages/app-server/test/model-client.delivery.test.ts`
- `packages/app-server/test/runtime-tool-views.test.ts`
- `packages/app-server/test/trpc-router.test.ts`
- `packages/app-server/test/workspace-tool-request-body.integration.test.ts`
- `packages/app-server/test/mock-loopbus.room-relay.integration.test.ts`

所以现在可以客观地说：

- 这轮 terminal lifecycle/config surface change 已经收口
- `packages/app-server` 显式 typecheck 已通过
- OpenSpec 严格校验已通过
- mock loopbus relay / runtime CLI / app-kernel / trpc surface 的回归测试都已重新对齐当前 law
