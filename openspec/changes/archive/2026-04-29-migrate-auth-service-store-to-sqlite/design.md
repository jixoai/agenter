## Context

`@agenter/auth-service` 当前已经是 canonical auth / identity / icon authority，但其 durable store 仍使用 DuckDB。这个选择让平台级 single-writer 约束退化成引擎级副作用：重复启动时，auth-service 暴露的是 DuckDB lock/WAL 语义，而不是自己的 authority lifecycle 法则。用户已经明确要求把 DuckDB 收敛为查询/兼容工具，把 durable store 切换为 SQLite。

现有限制：

- 现有 `ProfileStore` 完全绑定 `DuckDBConnection`
- 当前默认路径仍解析到 `auth-service.duckdb`，legacy profile path 只做目录兼容
- 真正的用户数据可能已经存在于 `auth-service.duckdb` 或 `profile-service.duckdb`
- 不能破坏 HTTP / service API，也不能制造第二个 writable authority

## Goals / Non-Goals

**Goals:**

- 让 SQLite 成为 auth-service canonical durable store
- 把 single-writer 约束升级为 auth-service 自己的显式 startup lock
- 保持 `ProfileService`、HTTP routes 和 CLI bridge 语义不变
- 更新 durable spec，使 canonical 路径、store engine 与 migration contract 一致

**Non-Goals:**

- 不重新设计 profile/principal/icon/challenge 数据模型
- 不改变 auth-service 对外 API、JWT、challenge 或 icon URL 语义
- 不在仓库代码中提供 DuckDB -> SQLite 运行期迁移或向下兼容逻辑
- 不引入第二套 sidecar file authority 或额外缓存数据库

## Decisions

### 1. SQLite 成为 canonical durable store

`@agenter/auth-service` 改用 `bun:sqlite` 持久化 profile、principal、challenge、credential、token 与 icon bytes。DuckDB 不再承担运行期真源，只保留为 legacy import source。

备选方案：继续使用 DuckDB，只在启动诊断层做修补。拒绝原因：这会让平台法则继续依附于分析型引擎细节，无法从根上分离 authority lifecycle 与查询引擎。

### 2. single-writer 约束显式化为 startup lock

auth-service 在 data dir 内维护显式 startup lock 文件。启动时通过原子创建 lock file 抢占 authority；若发现存活 PID 已持有该 lock，则直接失败并输出“复用 `--auth-service-endpoint` 或停止既有实例”的平台级诊断。若 lock 指向的 PID 已失活，则回收 stale lock 并继续启动。

备选方案：继续依赖 SQLite/DuckDB 的文件锁行为。拒绝原因：这会让 authority 生命周期法则继续被底层引擎偶然行为驱动，且不同引擎的报错语义不稳定。

### 3. canonical 文件名切换为 `auth-service.sqlite`

`resolveAuthServiceConfig()` 输出的 canonical `dbPath` 改为 `auth-service.sqlite`。如果 runtime 解析到了 legacy profile data dir，也仍然在该唯一 writable root 中创建 `auth-service.sqlite`，而不是继续写 `profile-service.duckdb` 或新建第二个目录。

备选方案：沿用 `.duckdb` 文件名但内部换成 SQLite。拒绝原因：会让 durable artifact 名称继续误导运维与未来工具，破坏 canonical law。

### 4. 旧 DuckDB 数据迁移保持为一次性本机运维动作

仓库代码不内置迁移脚本、runtime import 或向下兼容分支。本机旧 DuckDB 数据在本次改造收口后，通过一次性人工迁移导入到新的 SQLite 文件；旧 DuckDB 文件保留，不自动删除。

备选方案：把迁移逻辑常驻进 auth-service 运行期。拒绝原因：用户已明确不需要把一次性运维动作升级成长期产品法则，这只会增加未来维护负担。

### 5. ProfileStore 保持服务语义，改用 SQLite 连接原语

`ProfileStore` 仍然承担 auth-service 领域事实映射，但其底层读写从 `DuckDBConnection` 切换为 `bun:sqlite`。JSON 字段统一以 text 存储并显式 `JSON.stringify/parse`；blob 字段直接读写 `Uint8Array`。

备选方案：新增一层 ORM/Repository 抽象。拒绝原因：当前数据模型稳定、表数量有限，引入更厚抽象只会增加迁移噪音。

## Risks / Trade-offs

- [SQLite store 改写引入行为回归] -> 保持 service API 不变，并用 auth-service / bridge 定向测试覆盖主要 durable facts
- [显式 lock file 残留导致误阻塞] -> lock 文件保存 PID/command/createdAt；启动时校验 PID 是否仍存活，不存活则自动回收 stale lock
- [同时存在 SQLite 与旧 DuckDB 文件时 operator 误解真源] -> descriptor / log / spec 明确 SQLite 为 canonical runtime store；旧 DuckDB 仅作为保留的历史数据文件
- [store 重写引入行为回归] -> 保持 service API 不变，优先跑 auth-service 自测与 auth-service bridge 相关测试

## Migration Plan

1. 将 `resolveAuthServiceConfig()` 的 canonical `dbPath` 改为 `auth-service.sqlite`
2. 在 auth-service runtime 启动时先获取 startup lock，再打开/初始化 SQLite
3. 将 `ProfileStore` 改写为 SQLite 实现，并保持 service 层 API 不变
4. 更新 tests 与 durable specs
5. 对本机 `~/.agenter/auth-service` 做一次性 DuckDB -> SQLite 人工迁移，确认服务能以 SQLite 正常启动

Rollback:

- 代码层可回退到迁移前提交
- 数据层不自动删除旧 DuckDB 文件，因此如果 SQLite 切换有问题，仍可保留旧数据作为人工恢复源
- startup lock 是 sidecar artifact，关闭进程时释放；极端情况下可在确认无存活实例后删除 stale lock file

## Open Questions

- 真实本机迁移完成后，是否需要额外生成 `.migrated-from-duckdb.json` 一类 marker，还是以 SQLite 文件存在作为唯一事实即可？
