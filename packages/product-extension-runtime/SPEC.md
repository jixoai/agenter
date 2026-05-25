# @agenter/product-extension-runtime SPEC

> 本文件记录 `@agenter/product-extension-runtime` 的长期能力边界。

## 1. 角色

`@agenter/product-extension-runtime` 是 ordinary-user product 的平台契约包：

- 定义 product descriptor、resource binding、assistant initialization、attention projection 等 typed contract
- 让外部 product package 通过可编程接口消费 core capability，而不是 import core runtime internals
- 为未来 product 复用同一套 law，避免把 cli-shell 语义硬编码回 core

## 2. 长期法则

- package 只定义 generic contract，不定义具体 product grammar、terminal naming、toolbar layout、prompt wording 或 local UI state。
- product-owned assistant initialization 固定是 seed-if-missing：缺失 prompt/memory 可补齐，已有 avatar-private 文件始终是真源。prompt seed/read 的 identity 必须是 Avatar principal canonical root（`[~|<workspace>]/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`），nickname 只能用于发现，不能成为 prompt 真源。
- product prompt seed API 只允许 seed `AGENTER.mdx`。产品不得通过 session id、settings prompt path、nickname alias、`AGENTER_SYSTEM`、`SYSTEM_TEMPLATE` 或 `RESPONSE_CONTRACT` 创建第二套 prompt authority；复杂混合必须交给 `AGENTER.mdx` 内的 URL Slot。
- product-owned resource binding 固定使用 `productId + resourceKey + resourceKind`，而 terminal、room、AvatarRuntime、attention 的 authority owner 仍分别属于对应 system。
- GUI products 与 terminal products 使用同一套 product-extension law。`agenter-ext-studio` 只能通过 descriptor、launcher env、daemon/client-sdk、resource binding 与 attention contracts 消费平台能力，不能因为同仓库而 import core runtime internals。
- product descriptor 是数据，不是 core branch；新增 Studio 这类产品不得让 core runtime 出现 route state、SvelteKit build output、browser storage key 或 UI hosting 的特判。
- product runtime-session reset 必须通过 generic session authority 表达。输入只能选择 workspace + Avatar 这类平台级 runtime session 范围，不得把产品自己的 shell name、terminal role、UI mode 或测试语义塞进 runtime identity。
- runtime-session reset 只能删除或重建 runtime context，例如 model-call history、prompt-window history、cycle state 与 session-local artifacts。它不得删除 Avatar principal、nickname alias、canonical `AGENTER.mdx`、memory files、profile media、workspace files、terminal catalog entries 或 room catalog entries。
- product-scoped hosting work 固定通过 attention scheduler fact 表达；`hosting` 只是受控 score key，不得被解释成隐式 terminal write authority。
- autonomous terminal mutation 必须回到 TerminalSystem-native grant、guard approval request、timeboxed write lease 或等价 terminal authority fact；product-extension runtime 不拥有 product write delegation authority。
