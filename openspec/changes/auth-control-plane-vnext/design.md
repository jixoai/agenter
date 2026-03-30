## Context

仓库已经有一套 canonical identity / icon / child-runtime 基础，但名字和职责还是偏 `profile`，而用户的产品语义已经明确分裂成两层：

- `Auth`：谁有权操作 app-server、room、terminal。
- `Avatar`：Agenter 里的业务角色、提示词和 workspace 行为。

如果继续复用 `profile` 这个名字，后面所有 room / terminal grant 都会继续和 Avatar 角色搅在一起。

## Goals / Non-Goals

**Goals:**
- 把认证控制面统一改写成 `auth` 叙事。
- 定义 root auth key、challenge 登录、JWT、superadmin/admin claims。
- 让 app-server 可以把 auth-service 当作 child runtime 或 external authority 使用。
- 保持 Avatar 与 auth identity 的彻底分离。

**Non-Goals:**
- 不在这个 change 里定义 room grant 或 terminal ACL 细节。
- 不在这个 change 里处理 Avatar 目录结构、Workspace Avatar 管理或 session 编排。
- 不做旧 profile 数据的迁移兼容。

## Decisions

### 1. 名字统一改成 `auth-*`

- OpenSpec 的新 change 名、设计叙事、实现命名统一使用 `auth-*`。
- 现有 capability id 先保留 `profile-*`，只把内容改写成 auth 语义，避免这一轮同时做 spec namespace 大迁移。

为什么：
- 用户已经明确否定 `principal-*` 命名。
- 这轮先解决职责和实现命名，再决定以后是否做 capability id 清理。

### 2. 认证入口固定为私钥签名 challenge

- 默认认证流程是：请求 challenge -> 用私钥签名 -> 验证签名 -> 换取短期 JWT。
- email / WebAuthn 不再作为第一入口；后续即便保留，也只能是备选认证方式。

为什么：
- 这是用户明确指定的主路径。
- room / terminal 的 superadmin / admin 权限需要稳定的地址身份，而不是临时邮箱状态。

### 3. root auth key 是 app-server 的控制面根身份

- app-server 首次启动时读取或生成 root auth key。
- 这个 root auth identity 是全局 superadmin 的默认来源。
- room / terminal 系统的 superadmin 恢复能力都以它为上游 authority。

为什么：
- 全局资源在没有任何 session 运行时也要可管理。
- 不应该依赖某个 Avatar session 活着才能恢复全局权限。

### 4. 浏览器只拿 JWT，不持久化私钥

- WebUI 输入私钥只用于本地签名 challenge。
- 后续请求全部用短期 JWT，不把私钥长期放在 localStorage/sessionStorage 里做请求签名。

为什么：
- 用户已经明确选择“换短期 JWT token”。
- 这让 TRPC 和浏览器登录态回到标准模式，减少后续 UI 复杂度。

### 5. Auth identity 与 Avatar 永远分层

- auth identity 只表达“谁可以认证并持有授权声明”。
- Avatar 是 workspace / prompt / persona 的业务角色，不自动等于 auth identity。
- 运行中的 Avatar 通过 `session` 参与 room / terminal 协作，而不是直接等于 auth identity。

为什么：
- 这是这次重构的根法则之一。
- 如果不分层，QuickStart、Workspace Avatar、room grant、terminal grant 会全部纠缠。

## Risks / Trade-offs

- [legacy capability id 仍叫 `profile-*`] → 在 design 和 spec 文本里明确“这是 legacy id，不代表新命名”。
- [代码里现有 profile/icon 逻辑很多] → 这次只先统一 auth 语义，不在此 change 里强行重构所有 icon/avatar 逻辑。
- [root key 丢失会导致 superadmin 恢复复杂] → 明确 root auth key 是唯一上游管理身份，并由后续实现给出可恢复的文件/配置入口。
- [保留 email/WebAuthn 代码但不再是主路径，容易误导] → 后续实现必须把这些路径降级成 optional/legacy，而不是继续出现在默认 UI。

## Migration Plan

1. 先把 auth service 命名、descriptor、challenge/JWT contract 定下来。
2. 再把 app-server TRPC context 改成带 auth claims 的上下文。
3. 后续 room / terminal change 直接复用这个 auth 控制面，不再重复定义身份模型。

## Open Questions

- 这一轮先不处理 capability id 从 `profile-*` 改到 `auth-*`；等 4 个 focused changes 稳定后，再单独决定是否做 spec namespace 清理。
