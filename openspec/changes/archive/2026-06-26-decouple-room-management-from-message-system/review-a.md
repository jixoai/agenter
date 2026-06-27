## Review A

### Original User Law

- room 是共享 durability truth，不是 `message-system` 的私有子数据库
- `message-system` 是 superadmin 绑定的 system instance，默认本地实例与当前 superadmin 1:1
- 一个 room 将来要能接多个 `message-system`
- 一个 `message-system` 将来可以服务多个 Contact/user
- room 里的控制权要通过显式 `superKey` 表达
- `superKey` 不是 member seat，但它可以读 transcript、管理成员、管理房间
- Studio 是 superadmin 产品，要展示 domain/source/superKey/systemId，但低强调
- `web-chat-view` 是普通用户聊天视图，不要被 superadmin 管理 chrome 污染
- 远程方向以后统一走 room-management RPC，不再往本地接口里塞 remote 过渡胶水

### Alignment Conclusions

- 本 change 接受并强化这条 ownership law：
  - `room management` 拥有 room catalog、transcript truth、membership grants、revision、pub/sub durability
  - `message-system` 拥有 `systemId`、superadmin-root authority、Contact/key/proof/runtime concerns
  - room message / admin event 的 source provenance 必须由 room durability 直接记录为 `systemId` truth
- `systemId` 在当前版本明确等于当前 superadmin address，这不是临时投影，而是当前 breaking 版本的明确 law。
- `superKey` 必须继续与 participant seat 脱钩：
  - 可以读
  - 可以加成员/改配置
  - 可以 archive/delete room
  - 不能因为有 `superKey` 就被伪装成一个发送成员
- “只有 `superKey`、没有 seat” 不是特殊页面模式，而是 capability natural split：
  - 可读
  - 可管
  - 不可发
- UI 命名继续偏向 `Domain` / `Source`，而不是高强调 `Control`。

### Frontend Repo Truth

- 当前这个 worktree 里的 repo truth 仍然是：
  - Studio 直接 component-host `@agenter/web-chat-view`
  - 当前 `packages/web-chat-view` 还没有 Framework7 / `framework7-svelte` 依赖
  - 当前没有 iframe chat embedding
- 候选前端 worktree 已确认存在：
  - path: `.worktree/web-chat-view-review-shell`
  - branch: `feature/web-chat-view-review-shell`
- 该候选分支的 repo truth 已确认：
  - `packages/web-chat-view/package.json` 已引入 `framework7` / `framework7-svelte`
  - `packages/web-chat-view/example/*` 已有 Framework7 review shell
  - 存在 `framework7-convergence-contract.test.ts` 等 Framework7 对齐约束

### Merge Findings

- 这个候选 worktree 不是“可直接无脑合并”的状态：
  - 它当前有未提交改动
  - 当前 message-system worktree 也有大量未提交改动
  - 两边都碰了 `bun.lock`
- 因此现在不应该直接把整个 worktree 生硬 merge 进来。
- 更合理的路径是：
  - 先把这次 message-system change 的法则记录补齐
  - 再审查 `feature/web-chat-view-review-shell` 的已提交基线
  - 优先导入一个最小、已提交、可验证的 Framework7 `web-chat-view` baseline
  - 未提交的 review-shell 实验改动，要么先在源 worktree 收口成干净提交，要么在当前 worktree 按新法则重做

### Merge Result

- 已执行的实际策略不是“直接 merge 整个 worktree”，而是：
  - 使用 `feature/web-chat-view-review-shell` 这个已提交分支状态作为真源
  - 把 `packages/web-chat-view/*` 与相关 durable specs 导入当前 worktree
  - 明确排除 source worktree 上未提交的实验态文件
- 这次导入后的当前 repo truth：
  - `packages/web-chat-view/package.json` 已引入 `framework7` / `framework7-svelte`
  - `packages/web-chat-view/example/*` 的 Framework7 review shell 已进入当前 worktree
  - `packages/web-chat-view` 自身已经与当前 worktree 的 `message-system` / `svelte-components` 契约重新对齐

### Verification Result

- 已通过：
  - `bun run --filter '@agenter/web-chat-view' typecheck`
  - `bun run --filter '@agenter/web-chat-view' test:unit`
  - `bun run --filter 'agenter-app-studio' typecheck`
  - `git diff --check`
- 当前还没有做的事情：
  - 还没有开始 Studio 外层 room-management 壳层改造
  - 还没有对 `direct host` / `custom element` / `iframe` 做最终决策
  - 还没有跑 `web-chat-view` 的 Storybook DOM contract

### Next Plan

1. 先把 `superKey -> archive/delete room` 补进当前 change 的 proposal/design/tasks/spec。
2. 审查 `feature/web-chat-view-review-shell` 哪些提交属于“必须先导入的 Framework7 基线”，哪些只是后续优化。
3. 基线已导入；下一步继续 Studio 的 room/domain/source/superKey wrapper 改造。
4. 基于真实导入后的 host contract，再评估 `direct host` / `custom element` / `iframe`：
   - resize
   - auth/context injection
   - read-state/latest-visible callbacks
   - theme sync
   - BDD / Storybook / e2e 成本

### Scope Corrections

- 本 review 不把 `iframe` 提前冻结成 law。
- 本 review 不把 `superKey` 偷偷退化成 room admin participant。
- 本 review 不为了 remote 过渡而污染本地 room-management contract。
