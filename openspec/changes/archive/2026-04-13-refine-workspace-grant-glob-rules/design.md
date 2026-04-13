## Context

Workspace grant 的平台职责不是“存几个可写目录”，而是定义 Avatar 在某个 workspace 上的文件系统 authority。这个 authority 要同时驱动：

- one-shot workspace bash 的 read/write 能力
- root workspace bash 暴露真实绝对路径时的挂载边界
- terminal cwd 是否允许进入某个 workspace path
- workbench explorer/preview 能否看到某个 path
- runtime CLI / WebUI 展示给用户和 AI 的 grant facts

如果这几个表面各自做目录前缀判断，系统会继续腐化成一堆互不一致的补丁。

## Goals / Non-Goals

**Goals**
- 用一套 durable rule model 覆盖 shell、workbench、terminal、projection 的所有判权
- grant 语义与用户要求对齐：ordered glob rules、`ro|rw`、default deny
- 保持 avatar-root workspace 与动态 project workspace 的正交边界
- 为旧 snapshot 提供自动迁移，避免本地状态直接失效

**Non-Goals**
- 不在本轮实现 terminal 自己的读写细粒度权限系统
- 不引入第二套“deny/allow” DSL；仍然只保留 `mode`
- 不让 workspace 之间出现 overlay 继承顺序；每个 workspace 只解释自己的规则集

## Decisions

### 1. Grant record 升级为 `pattern + ruleIndex`

持久化记录改为：

- `pattern`: workspace-root-relative glob pattern，统一使用 `/` 分隔
- `mode`: `ro | rw`
- `ruleIndex`: 应用顺序，从小到大执行，last-match-wins

旧版 `relativePath` snapshot 在加载时自动迁移：

- `relativePath` 直接转成 `pattern`
- 如果旧规则是 `/` 或普通目录路径，则保持同样的目录授权含义

### 2. 规则匹配采用 minimatch，并显式声明目录规则语义

实现使用 `minimatch`，配置：

- `dot: true`
- `nocomment: true`
- `nonegate: true`

额外法则：

- 非 magic pattern（如 `/src`、`/tmp/cache`）视为“目录自身 + 全部后代”
- magic pattern（如 `/src/**/*.ts`）按 minimatch 原义匹配
- 路径访问求值使用 last-match-wins；无匹配则为 `none`
- 目录遍历使用 partial match，保证父目录在存在可访问后代时仍可进入

### 3. Shell 挂载改成“整 workspace + rule-aware filesystem”

不能再把整个 workspace 直接以 readonly overlay 暴露出去。

改为：

- 每个 mounted workspace 只挂载一次
- 挂载的底层是一个 `rule-aware fs wrapper`
- wrapper 内部把每个相对路径映射到 workspace grant evaluator
- 读操作要求 `ro|rw`
- 写操作要求 `rw`
- `readdir` 只返回仍然可读/可遍历的 child entries

这样 root workspace bash 仍然能看到真实绝对路径，但不会读穿未授权目录。

### 4. Terminal cwd 与 workbench preview 复用同一 evaluator

`cwd` 是否允许：

- 给定 `cwd` 时，只要该 path 对应 evaluator 结果不是 `none` 即可
- 未给 `cwd` 时，只有“恰好一个 mounted workspace 对 root path `/` 有可访问规则”才能自动选根

workbench explorer / preview：

- tree entry 的 `accessMode` 使用同一 evaluator
- preview 在 `explorer` 模式下也必须经过判权，不能绕过 rules 直接读文件

### 5. Projection 说真实规则，不再伪装成绝对路径根

runtime CLI / tRPC / client-sdk / webui 统一展示：

- `pattern`
- `mode`
- `ruleIndex`

不再导出误导性的 `absolutePath` 派生字段。

## Risks / Trade-offs

- [Risk] glob 规则的 partial traversal 会让目录可见性比“精确文件匹配”更复杂
  - Mitigation: 用共享 helper 统一 `match` / `partial match`，并用 workbench + shell regression 覆盖

- [Risk] API 形状从 `relativePath` 变成 `pattern`，会影响 webui/client-sdk
  - Mitigation: 本轮同步推进全链路重命名，避免 durable contract 继续讲错语义

- [Risk] shell wrapper 需要覆盖较多 FS 方法
  - Mitigation: 包裹 just-bash `ReadWriteFs`，只在授权判断层加法，不重写底层真实 FS 细节

## Validation Plan

1. 补 app-server 集成测试，覆盖 ordered glob overrides、default deny、terminal cwd、workbench preview
2. 回跑 `packages/app-server` 相关测试
3. 回跑 `packages/client-sdk` 与 `packages/webui` 的类型/行为测试
4. 确认 runtime CLI `workspace list` 与 rule editor 展示的是 `pattern + order`
