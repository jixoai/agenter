## Why

当前仓库里与认证有关的概念仍然混在 `profile` 这个名字下，结果是“认证身份”和“Avatar 业务角色”被写成了一个东西。要继续做全局 room / terminal 协作，必须先把认证控制权抽成一套清楚的 `auth` 法则，否则后面的授权、JWT、superadmin 都会继续挂在错误的概念上。

## What Changes

- **BREAKING** 把当前 `profile-service` 的认证叙事收口为 `AuthSystem` / `auth-service`，明确它只负责认证身份、授权声明、短期登录态和控制面权限。
- **BREAKING** 默认登录方式改为“私钥签名 challenge -> 短期 JWT”，不再把 email / WebAuthn 作为第一入口。
- AppServer 启动时加载或生成 root auth key，并用它作为全局控制面的 superadmin 身份来源。
- WebUI 登录改为输入私钥换 JWT，而不是在浏览器里长期保存私钥。
- 保留现有 `profile-*` capability id 作为 legacy spec 名称，但新的 proposal / design / 实现命名统一使用 `auth-*`。

## Capabilities

### New Capabilities

### Modified Capabilities
- `profile-auth-control-plane`: 认证入口改为 auth key challenge + JWT，会话声明从这里发出。
- `profile-identity-control-plane`: durable identity 改写成 auth identity；Avatar 不再属于 auth identity 本体。
- `profile-service-child-runtime`: app-server 与 auth-service 的 child/external authority 关系重写。

## Impact

- Affected packages: `profile-service`/future `auth-service`, `app-server`, `client-sdk`, `webui`.
- Affected APIs: auth challenge / verify / JWT issuance, TRPC auth context, root admin bootstrap, discovered auth descriptor.
- Verification: auth service tests, app-server integration tests, WebUI login walkthrough.
