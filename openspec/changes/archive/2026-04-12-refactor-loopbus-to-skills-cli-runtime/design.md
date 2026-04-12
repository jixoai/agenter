## Context

当前 runtime 已经有一部分新架构的雏形：

- attention 已经是内核里的第一执行模型；
- workspace bash 已经通过 `just-bash` 提供了非交互执行与工具箱命令；
- avatar identity 已经通过 principal/address canonicalize；
- 真实 AI 测试已经依赖显式挂载 room / terminal / workspace。

但 LoopBus 仍在承担两类不该长期存在的职责：

1. 把 message / terminal / workspace 的使用说明硬编码进 prompt bootstrap；
2. 直接把这些 systems 暴露成 model tools。

这会让内核持续膨胀，也不符合 skills 的渐进式发现哲学。新的目标是：LoopBus 只面向 attention，而其它 systems 作为可发现的 CLI/skills surface 让 AI 自助展开。

## Goals / Non-Goals

**Goals:**
- 用 root workspace + just-bash + CLI + skills 替代当前 direct model tools + system guide 注入模式
- 让每个 runtime 通过 principal private key 驱动一个 attention-scoped local API，供 message/workspace/terminal/attention CLI 使用
- 固定挂载按 principal 地址命名的 avatar root workspace，同时保留 dynamic multi-workspace mounts
- 将 AI-call 输入收缩为 `attention law + skills.list + minimal attention metadata`
- 用真实 AI CLI 测试验证单 Avatar、冷启动恢复、多 Avatar 协作仍然成立
- 只做后端实现；前端仅记录建议与对接注意事项

**Non-Goals:**
- 不做向下兼容，不保留长期双轨或 feature flag
- 不在本次改动中实现前端消费新接口的 UI
- 不在第一版增加 `cd` 之类的 shell convenience tool；`cwd` 仍显式传入
- 不把所有 project workspace 内容折叠进 avatar root workspace；动态 workspace 仍通过 mount/grant 管理

## Decisions

### 1. LoopBus 只保留 attention law、skills list 与 root workspace primitives

最终 model call 结构改为：

- `systemPrompt = attention law + skills.list`
- `tools = [root_workspace_list, root_workspace_bash]`
- `messages = [ContextSummary, AttentionContexts.metadata]`

理由：

- attention 仍是唯一调度真源；
- 其它 systems 的详情不再由内核预测式注入，而是由 AI 通过 CLI 自主发现；
- 这样 future systems 也能以相同模式挂入，不再扩大 kernel prompt surface。

备选方案：
- 保留 attention direct tools，只移除 message/terminal/workspace

不采用原因：
- attention 作为一个 system，也应当通过同样的 CLI/API 范式暴露，保持正交。

### 2. root workspace 固定挂载，但 dynamic workspaces 继续存在

每个 runtime 启动时固定挂载：

- `~/.agenter/avatars/<principal>`

它是 canonical private home，提供：

- `skills/`
- `memories/`
- `tools/`
- `tmp/`
- just-bash exec 基础环境

除此之外，project/workspace mounts 仍由 WorkspaceSystem 显式管理与恢复。

理由：

- root workspace 解决“开箱即用的私有执行空间”问题；
- dynamic workspaces 解决 multi-workspace 协作和项目隔离问题；
- 二者职责不同，不应该互相吞并。

备选方案：
- 只保留 root workspace，取消 dynamic workspace

不采用原因：
- 会破坏原有 multi-workspace 权限与协作模型。

### 3. attention-scoped local API 是其它系统 CLI 的唯一后端入口

每个 runtime 启动后在 loopback 上暴露一个 runtime-local API。

CLI 通过环境变量拿到：

- base URL
- principal id
- principal private key

并用 private key 作为身份进行认证。

理由：

- private key 就是身份；
- message/workspace/terminal/attention 都是 systems，应通过同一类 API surface 暴露；
- CLI 与 runtime 的耦合落在 API contract，而不是内存直连。

备选方案：
- 复用 app-server 全局 tRPC / kernel API

不采用原因：
- 这会让 runtime-internal automation 继续依赖全局 control plane，不够正交。

### 4. just-bash 保留，但 AI 看到的路径必须是真实绝对路径

实现上允许继续用 `MountableFs` / `ReadWriteFs`，但挂载点直接使用宿主的真实绝对路径，而不是 `/workspace` 这类虚拟路径。

理由：

- 降低 AI 的路径心智负担；
- 与 skills 和 CLI 输出保持单一信源；
- 避免“提示词里一套路径，shell 里一套路径”的失配。

备选方案：
- 保留虚拟根，再额外提供真实路径映射说明

不采用原因：
- 仍然增加理解成本，且容易在恢复场景里出错。

### 5. skills 采用 metadata 常驻 + 正文按需展开

运行时每轮只注入 `skills.list`，其中只包含 name / summary / path 级索引。AI 需要细节时，再通过 `ccski info` / `ccski search` 展开。

skills source 固定为：

- `~/.agents/skills`
- `~/.agenter/skills`
- `~/.agenter/avatars/<principal>/skills`

理由：

- 这符合 skills 的渐进式发现模式；
- prompt 保持小而稳定；
- project-specific 或 avatar-private skills 可自然叠加。

备选方案：
- 将 system usage example 继续直接注入 system prompt

不采用原因：
- 会重新回到 prompt 拼装膨胀。

### 6. 第一期先做加法，再裁剪旧路径，但对外表现是一轮切换

实现顺序上允许先加：

- attention API
- root workspace shell
- CLI/skills

再删旧 direct tools / bootstrap guide builder。

但 change 完成时，对外契约直接切到新路径，不保留长期兼容层。

理由：

- 有利于局部验证和真实 AI 测试；
- 最终又不留下双轨债务。

## Risks / Trade-offs

- [Risk] runtime-local API 新增了端口与生命周期管理复杂度
  → Mitigation: 只绑定 loopback，跟随 `SessionRuntime.start/stop` 生命周期，base URL 写入 runtime snapshot 与 shell env

- [Risk] root workspace 改成全局 canonical home 后，测试可能污染真实 `~/.agenter`
  → Mitigation: 为 kernel/runtime 引入 `homeDir` 注入能力，真实测试用临时 home

- [Risk] 一次性移除 direct tools 可能让现有真实 AI 测试大面积失效
  → Mitigation: 先完成 CLI/skills skills 文件与 root workspace shell，再重写 harness 与 scenario，使回归直接面向新路径

- [Risk] `ccski` 运行时发现能力若只靠 CLI shell-out，可能偏慢
  → Mitigation: 第一版先保证功能正确；后续若有必要，再切到 SDK 或增加缓存

- [Risk] 真实绝对路径挂载如果处理不当，可能扩大 bash 可见范围
  → Mitigation: 只挂 root avatar home 与当前 runtime 已授权的 workspace grants；未挂载路径在 shell 中不可访问

## Migration Plan

1. 新增 OpenSpec 能力与后端接口说明，锁定新 contract
2. 在 runtime 中引入 `homeDir`、root workspace mount、attention API、skills list 生成
3. 增加 root workspace direct tools 与 shell builtin CLI commands
4. 用 CLI 实现 attention/message/workspace/terminal 命令
5. 将 prompt builder 和 bootstrap 输入切到新模型
6. 重写真实 AI harness/scenario 到 CLI 路径
7. 删除旧 direct tools 与旧 system guide 注入逻辑

回滚策略：

- 若本轮实现未完成，则保留 change 未归档，不同步主 spec；
- 一旦切换完成，不再维护旧 direct-tools path。

## Open Questions

- `ccski` 第一版是否直接使用 CLI shell-out，还是在实现过程中切到 SDK；这不影响对外 contract，但会影响内部性能实现
- 后续是否需要为 shell convenience 增加 `cd` model tool；本次默认不做
