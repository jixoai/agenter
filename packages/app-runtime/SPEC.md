# @agenter/app-runtime SPEC

> 本文件记录 `@agenter/app-runtime` 的长期能力边界。

## 1. 角色

`@agenter/app-runtime` 是 ordinary-user app 的平台契约包：

- 定义 app descriptor、resource binding、assistant initialization、attention projection 等 typed contract
- 让外部 app package 通过可编程接口消费 core capability，而不是 import core runtime internals
- 为未来 app 复用同一套 law，避免把 Shell 语义硬编码回 core

## 2. 长期法则

- package 只定义 generic contract，不定义具体 app grammar、terminal naming、toolbar layout、prompt wording 或 local UI state。
- package root export 是 browser-safe 的跨端合约入口。Node-only 文件资产解析只能通过显式 `@agenter/app-runtime/bundled-assets` 子路径消费，不得重新挂回 root export。
- app-owned assistant initialization 固定是 seed-if-missing：缺失 prompt 可补齐，已有 global Avatar principal-root 文件始终是真源。prompt seed/read 的 identity 必须是 global Avatar principal canonical root（`~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`）；raw recording 默认属于 NoteSystem 的 `AVATAR_HOME` note facts，而不是 app-runtime 自己的 memory pack。nickname 只能用于发现，不能成为 prompt/note 真源；普通 workspace 不得作为 app-owned prompt 或默认记录 root authority。
- app prompt seed API 只允许 seed `AGENTER.mdx`。产品不得通过 session id、settings prompt path、nickname alias、`AGENTER_SYSTEM`、`SYSTEM_TEMPLATE` 或 `RESPONSE_CONTRACT` 创建第二套 prompt authority；复杂混合必须交给 `AGENTER.mdx` 内的 URL Slot。app-owned prompt body 应作为 package resource 暴露，并由 `app:<app-id>/<file>` 或 `npm:<package-name>/<file>` Slot 引入；需要继承平台默认提示词时，`AGENTER.mdx` 必须显式使用 `global:builtin/$LANG/AGENTER.mdx`，而不是把 builtin root 放进 `AVATAR_HOME` 或 `super:` 层级。
- workspace-private text assets 仍可用于显式 workspace overlay/artifact，但不得作为 app-owned assistant 默认记录路径；app-runtime 不提供 app-owned memory-pack API，默认记录能力必须通过 NoteSystem 这类独立系统 atom 投射。
- app-owned resource binding 固定使用 `appId + resourceKey + resourceKind`，而 terminal、room、AvatarRuntime、attention 的 authority owner 仍分别属于对应 system。
- GUI apps 与 terminal apps 使用同一套 app runtime law。`agenter-app-studio` 只能通过 descriptor、launcher env、daemon/client-sdk、resource binding 与 attention contracts 消费平台能力，不能因为同仓库而 import core runtime internals。
- app descriptor 是数据，不是 core branch；新增 Studio 这类产品不得让 core runtime 出现 route state、SvelteKit build output、browser storage key 或 UI hosting 的特判。
- app-owned assistant ensure 只接受 app id 与 Avatar catalog fields（nickname/display/classify），不得接受 `workspacePath` 作为 assistant identity 或 creation authority。
- app runtime-session reset 必须通过 generic session authority 表达。输入只能选择 `avatarPrincipalId`，不得把 workspace、产品自己的 shell name、terminal role、UI mode 或测试语义塞进 runtime identity。
- runtime-session reset 只能删除或重建 runtime context，例如 model-call history、prompt-window history、cycle state 与 session-local artifacts。它不得删除 Avatar principal、nickname alias、canonical `AGENTER.mdx`、NoteSystem note files、legacy memory files、profile media、workspace files、terminal catalog entries 或 room catalog entries。
- app-scoped hosting work 固定通过 attention scheduler fact 表达；`hosting` 只是受控 score key，不得被解释成隐式 terminal write authority。
- autonomous terminal mutation 必须回到 TerminalSystem-native grant、guard approval request、timeboxed write lease 或等价 terminal authority fact；app runtime 不拥有 app write delegation authority。
