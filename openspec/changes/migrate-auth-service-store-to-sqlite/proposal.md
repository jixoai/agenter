## Why

`@agenter/auth-service` 当前把 DuckDB 当作 canonical durable store，但它承载的是 auth / identity / icon 这类高频小事务事实，而不是分析型查询。现状把 single-writer 约束、WAL 恢复和运维诊断都绑在 DuckDB 行为上，导致 child runtime 与独立实例更容易因为重复启动而暴露引擎级冲突，而不是平台级法则。

## What Changes

- **BREAKING** `@agenter/auth-service` 的 canonical durable store 改为 SQLite，默认数据库文件改为 `.agenter/auth-service/auth-service.sqlite`
- auth-service 启动时增加显式 single-writer startup lock，避免平台法则继续依赖底层数据库报错文本
- 保持 auth-service HTTP / service API、profile projection、principal registry、challenge / credential / token 语义不变
- 更新 durable specs、runtime config、测试与 operator 诊断文案，使 SQLite 成为唯一 canonical runtime store；旧 DuckDB 数据迁移作为一次性本机运维动作，不沉淀为产品兼容逻辑

## Capabilities

### New Capabilities
- `auth-service-store-engine`: 定义 auth-service canonical store engine 与 startup lock contract

### Modified Capabilities
- `profile-service-child-runtime`: auth-service child runtime 的默认 store 文件发生变更

## Impact

- `packages/auth-service` store/runtime/config/spec/tests
- `packages/cli` 通过 standalone / external auth-service 复用时的启动行为与诊断
- `packages/app-server` child runtime 对 auth-service store root 的 durable contract
- OpenSpec durable specs 与 `packages/auth-service/SPEC.md`
