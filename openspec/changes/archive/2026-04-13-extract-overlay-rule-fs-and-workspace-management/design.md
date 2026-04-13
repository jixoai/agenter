## Context

WorkspaceSystem 目前已经有明确的 mount / grant / public-private asset law，但真正负责执行这些规则的文件系统层仍然是 `packages/app-server/src/workspace-system/granted-fs.ts` 里的私有实现。它已经满足一部分能力，却存在三个结构性问题：

1. 规则层和 `app-server` 耦合，无法作为 just-bash 的独立原语复用。
2. 当前实现只支持构造时注入 grants，不适合后续的动态 rules / notification / shell 面板扩展。
3. `/workspaces` 现在更像“文件页面”，还没有把 mount / unmount for Avatar 做成真正的管理入口。

另一方面，仓库已经具备需要复用的基础：

- `just-bash` 暴露了 `IFileSystem` 接口以及 `OverlayFs` / `ReadWriteFs` / `MountableFs`
- `app-server` 已经有规则解析、workspace grants、runtime mounts 和 detach API
- `webui` 已经有 `Explorer / Rules / Private` 主壳层，以及可复用的 `ManagementDialog` 设计范式

## Goals / Non-Goals

**Goals:**

- 抽出一个独立包 `@agenter/just-bash-overlay-rule-fs`，作为 just-bash 的规则文件系统原语。
- 让 root workspace bash 和 workspace bash 都通过同一套 rule-fs 实现权限执行。
- 让 rule-fs 支持动态规则配置，而不是只能在构造时写死。
- 在 `/workspaces` 增加一个 workspace-centric 的 `ManagementDialog`，用于 Avatar mount / unmount 和 grant 管理。
- 给这轮变更补真实回归，且验证顺序固定为“命令行真实 AI 测试 -> 浏览器走查”。

**Non-Goals:**

- 这轮不把 `Heartbeat` 全面切到 `svelte-ai-elements`。
- 这轮不强行交付完整的 workspace bash 面板，只在实现顺手时保留最小扩展点。
- 这轮不重构所有旧式 `/workspace` 虚拟根语义；只要求 root/workspace bash 共用同一 rule-fs 原语。
- 这轮不引入另一套非 JSON CLI 语法。

## Decisions

### Decision: 新建独立包 `@agenter/just-bash-overlay-rule-fs`

把规则层从 `app-server` 私有类中抽离，放进一个新的 workspace package，导出：

- `OverlayRuleFs`
- rule config / snapshot types
- path normalization / matching helpers（仅限规则层真正需要的部分）

理由：

- 这符合“平台法则先行”的方向，规则层应该是 just-bash 可复用原语，而不是 `app-server` 业务细节。
- 后续如果 message / terminal / browser 等 shell surface 也需要类似规则执行，它们可以直接复用这个包。

备选方案：

- 继续保留 `GrantedWorkspaceFs` 在 `app-server` 内部：实现快，但会继续把规则层锁在一个服务里。
- 直接 fork/patch `just-bash`：破坏外部依赖边界，也会让仓库维护成本失控。

### Decision: `OverlayRuleFs` 直接实现 `IFileSystem`，而不是继承 `OverlayFs`

`OverlayFs` 的安全边界和 real-fs 语义值得参考，但它的实现并不是为“外部继承并插入权限规则”设计的。当前仓库里也已经有一套成熟的 `IFileSystem` 权限门面逻辑。  
因此这一轮采取：

- 参考 `OverlayFs` 的 real-path / symlink / sandbox 设计原则
- 直接实现 `IFileSystem`
- 在内部组合真实文件系统访问，而不是依赖继承去篡改 `OverlayFs`

理由：

- 可以稳定支持 ordered glob rule、partial traversal、readdir filtering、dynamic config
- 不会把实现建立在 `OverlayFs` 私有字段或不稳定继承点上
- 更容易为 Avatar 私人抽屉隔离提供明确的 policy 层

备选方案：

- 继承 `OverlayFs`：如果 upstream 私有实现变动，子类很脆。
- 继续只用 `ReadWriteFs + app-side checks`：缺少独立包和动态配置模型。

### Decision: Rule config 使用动态 source，而不是“每次改 rules 就重建 fs”

`OverlayRuleFs` 提供可更新的 rules source，最小模型是：

- 构造时传入 `getRules(): RuleSnapshot`
- 或者提供 `setRules(nextRules)` / `replaceConfig(nextConfig)` 这类直接更新接口

读取和写入时实时读取当前规则，而不是假设 rule-fs 生命周期短到足以每次重建。

理由：

- 后续 workspace rules 编辑、私人抽屉隔离、bash 面板共用 shell，都需要动态规则。
- 这比“操作后销毁 bash 实例、重建 fs”更接近平台原语。

### Decision: 私人抽屉隔离属于 rule-fs 自己的责任，不交给 UI 猜

`OverlayRuleFs` 必须支持“同一个 workspace 下，不同 Avatar 只能看到自己的 private roots”。  
具体做法是让配置层显式注入：

- public roots
- current avatar private roots
- hidden roots that belong to other avatars

然后在 `read/readdir/stat/exists` 上统一执行。

理由：

- 这是平台隔离，不是页面文案。
- 如果只靠 UI 不显示，shell 和 API 仍然可能越权。

### Decision: Workspace management 放在 `/workspaces`，不回流到 Avatar detail

`ManagementDialog` 的职责是：

- 以 workspace 为中心，列出相关 Avatar
- 展示哪些 Avatar 已 mount 当前 workspace
- 执行 mount / unmount
- 编辑该 workspace 对该 Avatar 的 grants

`AvatarDetail` 继续聚焦 `Heartbeat / Attention / Settings`，不承接 workspace 管理。

理由：

- 这和 message room 的 `ManagementDialog` 语义一致
- 保持“系统页管理资源、runtime 页关注工作流”的边界

### Decision: 验证顺序固定为“真实 AI CLI -> 浏览器走查”

这轮的核心风险先在平台法则，不在样式细节，所以验收顺序固定：

1. 命令行真实 AI 测试
2. 浏览器走查

理由：

- 先确认 rule-fs + runtime shell 的真实工作链路
- 再确认 `ManagementDialog` 和 workspace workbench 的产品面交互

## Risks / Trade-offs

- [Risk] `OverlayRuleFs` 自己实现 `IFileSystem` 后，如果漏掉某些 `OverlayFs` 的安全细节，可能引入路径逃逸或 symlink 漏洞。  
  → Mitigation: 参考 `OverlayFs` 的 real-path 约束和错误处理方式；补 unit/integration tests 覆盖 readdir/read/write/stat/symlink 边界。

- [Risk] 新包抽出后，root workspace bash 和 workspace bash 的行为可能出现不一致。  
  → Mitigation: 两条 shell surface 都改为同一个 package；保留现有 integration tests，并新增覆盖 dynamic rules 的场景。

- [Risk] Workspace `ManagementDialog` 可能与现有 `Rules` 模式职责重叠。  
  → Mitigation: 明确分层，`ManagementDialog` 负责 mount/unmount + avatar-grant 入口，`Rules` 仍负责当前 `View as` lens 的文件权限工作流。

- [Risk] 这轮如果顺手加 bash 面板，可能扩散范围。  
  → Mitigation: bash 面板不进入任务主线，除非实现只需要极小增量。

- [Risk] 真实 AI 测试可能受外部 provider 配置或配额影响。  
  → Mitigation: 使用现有 `jixoai/agenter/test` 门槛和 fail-fast precondition；浏览器走查放在其后执行。

## Migration Plan

1. 新建 `packages/just-bash-overlay-rule-fs`，把现有规则文件系统逻辑迁出并升级为动态配置模型。
2. `app-server` 的 root/workspace bash 改接新包，保留现有 public contract。
3. 追加 rule-fs 与 shell 集成测试，再跑真实 AI CLI 测试。
4. 在 `webui` 增加 workspace `ManagementDialog`，接上 mount/unmount 和 grants API。
5. 完成浏览器走查后，再同步 durable specs、archive change。

回滚策略：

- 如果前端产品面有问题，可以只回退 `webui` dialog 相关提交，不影响 rule-fs 包。
- 如果 rule-fs 接入出问题，可以先回退 `app-server` 接线，保留新包与测试工作在 change 内继续修正。

## Open Questions

- `OverlayRuleFs` 的动态配置接口最终暴露成 `setRules(...)` 还是 `replaceConfig(...)`，取决于实现时最小 API。
- 这轮是否顺手交一个最小 workspace bash 面板，取决于 rule-fs 抽离后的边际成本；默认不承诺。
