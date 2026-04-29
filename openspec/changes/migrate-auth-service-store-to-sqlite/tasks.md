## 1. Store Law

- [x] 1.1 更新 auth-service runtime/config/database 打开流程，使 canonical dbPath 切换到 `auth-service.sqlite`
- [x] 1.2 为 auth-service 增加显式 startup lock，并保留清晰的 external endpoint 复用诊断

## 2. Store Implementation

- [x] 2.1 将 `ProfileStore` 从 DuckDB 连接改写为 SQLite 读写实现
- [x] 2.2 保持 profile/principal/icon/challenge/credential/token 语义不变，并更新 schema 定义

## 3. Verification

- [x] 3.1 新增或更新 auth-service store tests，覆盖 SQLite 初始化与 startup lock
- [x] 3.2 跑 auth-service、app-server bridge、CLI 相关定向验证
- [x] 3.3 更新 durable specs，并对本机 `~/.agenter/auth-service` 做一次人工迁移与启动验证
