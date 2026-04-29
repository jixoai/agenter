## 1. Discovery Law

- [x] 1.1 为 auth-service 增加 authority-scoped runtime descriptor sidecar
- [x] 1.2 在 auth-service start/stop 生命周期中维护 runtime descriptor

## 2. Bridge Reuse

- [x] 2.1 让 auth-service bridge 在无显式 endpoint 时优先探测本地 descriptor 并复用健康实例
- [x] 2.2 让 bridge 在 child 启动竞争失败后回退到 descriptor 复用
- [x] 2.3 保持 auto-reused local authority 的 descriptor/reveal 语义为 external-like

## 3. Verification

- [x] 3.1 补 auth-service descriptor sidecar tests 与 auth-service bridge unit tests
- [x] 3.2 补 CLI e2e，覆盖“已有本地 standalone auth-service 时 daemon 默认自动复用”
