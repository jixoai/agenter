## Why

当前 `web/daemon` 即使和本地已有 `auth-service` 指向同一个 authority root，也只有两种行为：显式传 `--auth-service-endpoint` 复用，或者盲目再起一个 child runtime 并撞上 single-writer 冲突。系统缺少“同一 authority 已存在时自动复用”的默认法则。

## What Changes

- auth-service 在 authority root 内发布本地 runtime descriptor，客观暴露当前 endpoint、pid、dataDir 和 root auth key path
- app-server 的 auth-service bridge 在未显式配置 external endpoint 时，先探测并复用同一 authority root 下已有且健康的本地 auth-service
- 如果 child auth-service 启动过程中与已有 authority 发生竞争，bridge 回退到 runtime descriptor 探测并自动复用
- 保持显式 `--auth-service-endpoint` 优先级最高；自动复用只作用于相同 local authority root

## Capabilities

### New Capabilities
- `auth-service-runtime-discovery`: 定义 auth-service 本地 runtime descriptor 的发布与复用 contract

### Modified Capabilities
- `profile-service-child-runtime`: child runtime 在本地已存在同 authority auth-service 时改为自动复用而不是重复启动

## Impact

- `packages/auth-service` runtime startup / shutdown descriptor sidecar
- `packages/app-server` auth-service bridge startup law
- `packages/cli` daemon/web/tui 默认 auth-service 复用行为
- OpenSpec durable specs 与相关测试
