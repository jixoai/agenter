## Context

SQLite 切换后，auth-service 已经具备显式 single-writer startup lock，但当前平台仍把“发现已有本地 authority”这件事留给 operator 显式传 `--auth-service-endpoint`。这导致 `web --dev`、`daemon`、`tui` 在面对同一个 authority root 时仍然倾向于先重复启动，再由锁报错阻止。

更正确的法则是：同一 authority root 只能有一个 writer，而 consumer runtime 应优先复用该 writer。要做到这一点，auth-service 必须像数据库 lock 一样，把“我是谁、我在哪个 endpoint 提供 authority”也持久地公布出来。

## Goals / Non-Goals

**Goals:**

- auth-service 启动后在 authority root 内写出客观 runtime descriptor
- app-server bridge 默认先探测并复用同 authority root 的健康 auth-service
- 启动竞争时，bridge 在 lock 冲突后也能回退复用 descriptor 指向的实例
- 保持显式 `endpoint` 配置优先级最高

**Non-Goals:**

- 不做跨机器或跨用户的 auth-service 服务发现
- 不用“猜默认端口”的方式替代 authority-root 发现
- 不改变 auth-service HTTP contract、JWT 或 root-auth bootstrap 语义
- 不移除 single-writer startup lock；descriptor 是复用入口，不是并发写放行器

## Decisions

### 1. auth-service 发布 authority-scoped runtime descriptor

在 `dataDir` 内新增 `auth-service.runtime.json`，记录：

- `pid`
- `endpoint`
- `dataDir`
- `rootAuthKeyPath`
- `updatedAt`

descriptor 在 server 已监听后写入，并在 stop 时仅由 owner 清理。

备选方案：app-server 只探测默认端口。拒绝原因：端口不是 authority identity；同一机器可有多个 auth-service 实例，不同 data dir 也可能绑定不同 port。

### 2. bridge 先发现，再启动；失败后再回退发现

`AuthServiceBridge` 在没有显式 `endpoint` 时：

1. 先读取目标 authority root 的 runtime descriptor
2. 探测 descriptor.endpoint 的 `/health`
3. 若健康，则将其视为 `external-like` local authority 直接复用
4. 若无 descriptor 或不健康，则继续启动 child handle
5. 如果 child 启动期间仍撞上 single-writer 竞争，则再读 descriptor 并复用一次

备选方案：仅在启动失败后再探测 descriptor。拒绝原因：这仍然把冲突当成正常路径，不能实现“默认优先复用”。

### 3. 自动复用的本地 authority 语义上等价于 external

当 bridge 复用了已有本地 auth-service，而不是自己持有 child handle 时，`describe()` 必须把它视为 external-like authority：

- `rootAuthBootstrapMode = "external"`
- `canRevealRootAuthPrivateKey = false`
- `hasManagedRootAuthPrivateKey = false`

备选方案：把 auto-reused local 继续伪装成 `managed_local`。拒绝原因：当前 runtime 并不拥有该服务生命周期，也不应暴露 root key reveal 能力。

## Risks / Trade-offs

- [descriptor 残留但 endpoint 已失效] -> bridge 必须在复用前做健康探测；失败则忽略 descriptor
- [同一进程多次并发请求时重复探测/重复启动] -> 继续复用 bridge 现有 `childHandlePromise` 序列化启动路径
- [operator 混淆 external 与 reused_local] -> 对外 descriptor 继续统一呈现为 external-like；内部仅用 discovery source 决定 stop/reveal 语义

## Migration Plan

1. 给 auth-service 增加 runtime descriptor sidecar 工具与启动/停止写入
2. 在 bridge 中加入 local descriptor 探测与健康复用
3. 补 bridge unit tests 与 CLI e2e
4. 同步 durable specs
