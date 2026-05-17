# Research: add-mcp-system

## User Request Ledger

<history>
<user>新任务：research指定任务，并撰写对应的 openspec change。

指定任务：
```
新增 mcpSystem 模块。
1. mcp-cli，运行在 root-workspace 中。
    1.1. 全面地支持各种 mcp 协议。包括 stdio/sse 等
    1.2. 使用分两步走：安装命令模板， 启动命令
    1.3. 支持自定义目录来启动，每一个目录自动锁定一个实例
    1.4. 每次使用，都需要传递目录，使用的对应目录的实例没有启动，会自动启动（也就是说，通常都不用手动启动，直接使用即可）
    1.5. 可以手动关停、或者重启。可以用于处理资源释放或者异常问题
    1.6. 支持基于目录，列出有哪些 mcp 实例，这里目录没有继承关系
    1.7. 支持全局查询有哪些mcp模板、以及命令ß的概览（基于组后最新一次实例启动后的信息作为参考）
    1.8. 支持全局查询有哪些目录，每个目录下有哪些 mcp 实例（这里只是一个概念，具体可以用 1.6 进行进一步细化查询）
2. mcp-system-skills，提供完整的全局使用教程，和 `mcp <command> --help` 搭配使用
    > skills 更加注重于教会 AI 这个 cli 的整体设计，比如有哪些功能，遇到问题如何处理

```

你负责调查任务背景与实现方案，然后过程中需要不停和我提出建议和问题，一边撰写changes文件（记录你的调查过程和结果、记录我们的讨论过程），直到最终review下来这份changes完美闭环。</user>
<ai>计划: 加载本地技能和记忆，创建隔离 worktree，调查官方 MCP transport/lifecycle 与仓库 runtime-local CLI/skill/WorkspaceSystem 法则，先写 research-first OpenSpec change，不做实现。</ai>
<ai>决策: 将 change 命名为 add-mcp-system，并在 .worktree/add-mcp-system 中工作，避免污染 main checkout 当前未提交的 cli-shell/runtime 改动。</ai>
<ai>决策: 将 mcpSystem 定位为新的 runtime system 原子，而不是普通产品子命令或 provider tool 注入；mcp-cli 运行在 root-workspace shell 中，通过 descriptor-backed runtime-local CLI/API 暴露。</ai>
<ai>决策: mcp-system-skills 定位为 mcpSystem 自带 built-in skill，用于 teach AI 全局使用教程、排障路径与 help 发现法，而不是第二个 durable truth owner。</ai>
<user>1. 是，我已经明确说了
2. 是的，安装的时候，请参考 claude/codex/Gemini 等安装mcp的方式，它们几乎都一样，我们可以参考借鉴。
3. 必须包含，否则没有意义

补充：
4. 这里最重要的设计是三方面： 安装、查询、调用。其中查询是最复杂的，它需要考虑多个维度的查询来满足多种场景，因此你在设计接口的时候，要确保设计出来的接口符合AI的使用直觉。比如我已经举例的记录目录的查询，还有可以基于模板名称的查询，可以查询出某一个mcp目前在哪些目录下有哪些实例。
5. 我缺了一个关键的设计，不是说一定要启用才有这个实例，我们需要全局维护一张表，来表明，哪些目录配置了：“使用哪些实例”。也就是说，即便这个mcp没启动，那么也可以有这个实例。也可以直接使用（因为我们用的时候会自动启动）
6. 这样设计的目的，是为了做到和传统mcp一样使用的效果。
7. 有一个细节，我之前说到mcp没有启动，但我们可以记录它最后一次启动的一个快照作为描述信息。这个要注意，必须基于目录隔离。也就是说，目录之间是不共享的。


---
整理我以上这些设计，继续讨论</user>
<ai>决策: 确认 directoryPath 为显式绝对路径且无继承；确认模板先存 avatar-private root；确认第一版必须包含 tool-call；将 mcpSystem 核心重排为安装、查询、调用三轴，并新增 configured binding 表作为未启动实例的 durable truth。</ai>
<user>1. 统一查询入口。另外，我建议使用“单个单词”的设计，mcp这些功能都很简单，没必要用双单词（除非你只是在讨论的时候使用，避免歧义），最终落地的时候，要确保足够的简单、符合直觉，比如add、query、call这样的单词即可
2. bindingName？我觉得你目前的设计可能有点复杂了，我没有设计过bindingName这个东西吧。我需要你把目前的设计简化后，列出来，我们来讨论</user>
<ai>决策: 收敛为单词 CLI：add/query/call/start/stop/restart/remove/get/list；保留统一 query 入口；移除 bindingName；把“binding”降级为内部目录配置关系，不作为 AI 需要命名的对象。</ai>
<user>1. 允许
2. 把directory和template关键词，换成 project和global。同意必须带字段</user>
<ai>决策: 允许 `mcp add` 的 `scope:"project"` 输入在携带 `transport` 时同时创建/更新 global config；公开术语从 directory/template 收敛为 project/global；对存在歧义的管理命令使用显式 `scope:"global" | "project"` 字段，尤其 `mcp remove` 必须带 `scope`。</ai>
<user>不行，你把global/project的概念错误理解了。把add/remove的scope概念移除掉，它们现在只针对global。
把start/stop/restart 的概念给project，指具体的进程管理
再加入一个enable/disbale给project，对标add/remove。默认都是disabled的状态。具体一点，如果我mcp add，然后到project查询这个mcp是否在这个目录启用，默认会查询到disabled。
加入一个mcp list，针对project，可以直接列出当前目录目前有哪些mcp（enabled）可用，可以看到它们的介绍信息。如果没有启动，那么就显示最后一次启动的快照信息，当然如果没启动过，那么就什么信息都没有。
使用 mcp call ，如果是没有启动的mcp，可以直接启动，但前提是这个mcp 已经在当前目录enabled ，否则报错。这两个行为分别通过 autoStart=true 和 autoEnabled=false 这两个参数来决定，因此可以修改参数来控制这些默认行为。

---

在以上设计的基础上，重新设计mcp query，然后给出你的建议和问题</user>
<ai>决策: 废弃 `add/remove` 的 scope 设计，改为 global-only；新增 project-facing `enable/disable/list`；保留 project-facing `start/stop/restart/call` 作为进程与调用控制；所有 global 在每个 project 默认 disabled；`mcp call` 默认 `autoStart:true` 且 `autoEnabled:false`；重新设计 `mcp query` 为 global/project/state/capability 四类调查入口。</ai>
<user>1. 同意
2. 同意
3. 新增一个 stop=false 的默认值
4. 同意，但是我想更加彻底一点，query直接面向SQL来设计，当然查询的时候，是我们映射到一张表，这张表的结构，可以用 query --help 获得，然后就可以用sql语句来查询表。这样能充分利用AI的编程能力。同时也意味着，我们底层需要使用sqlite来存储。不过这已经是bun内置的能力，所以开箱即用。
5. 参考4.，只要实现了临时表的查询功能，这些都不是问题了</user>
<ai>决策: 将 `autoEnabled` 改名为动作开关 `autoEnable`；确认 `mcp disable` 默认 `stop:true`；为 global-only `mcp remove` 增加 `stop:false` 默认值；将 `mcp query` 改为 read-only SQL surface，`mcp query --help` 暴露临时表结构，底层持久化切换为 avatar-private SQLite。</ai>
<user>1. 不用，在skills中应该介绍最佳实践：默认情况下不应该提供stop:true，如果有项目正在使用，就会报错，基于报错信息了解到有哪些项目还在使用，这时候如果确定还是可以remove，就可以直接调用stop:true。所以用两次stop就可以做到二次确认的效果
2. 同意
3. mcp query有两种表，一种是安装的表（mcp add），一种是启用的表(mcp enable)。不要再去用capability做区分了</user>
<ai>决策: `mcp remove stop:true` 不再增加额外二次确认字段；由 skill 教默认 remove 读取占用项目报错，再明确 stop:true 的两步确认实践；`mcp query` 只支持 named params；SQL query 临时表改为 `mcp_installed` 与 `mcp_enabled` 两张表，不再暴露 capability row/table，能力信息只作为 enabled 表上的 project-local snapshot JSON/overview。</ai>
<user>1. 永远返回JSON
2. 完整实现，因为这根本不用你去实现，对接官方的标准库就行
3. secret references 具体是什么概念，不过理论上我们统一用 root-workspace runtime env就够了</user>
<ai>决策: `mcp query` 执行结果固定为 JSON rows，不设计 table/text 输出；首版完整实现 stdio、Streamable HTTP、SSE 三类 MCP transport，并通过官方 MCP TypeScript SDK client transport 对接；不引入独立 secret-reference 系统，env 权限收敛到 root-workspace runtime env 加 literal global/transport overlay。</ai>
<user>补充一下，我们最后需要并进行真实的 AI 测试，使用这个：modelcontextprotocol/server-sequential-thinking 来测试 stdio 的 mcp，sse 相关的，你自己网上找一个靠谱的来测试</user>
<ai>决策: 将真实 AI 测试提升为 archive 前验收契约；stdio 固定使用 `@modelcontextprotocol/server-sequential-thinking`；SSE 优先使用官方 TypeScript SDK `simpleSseServer` 示例或等价本地 SDK fixture，而不是依赖不稳定公网服务。</ai>
</history>

## Evidence Collected

- Repository law: `SPEC.md` says model rounds expose only `workspace_list`, `root_bash`, and `workspace_bash`; message/workspace/terminal/future systems must be discovered through runtime-local CLI/API, not injected directly as model tools.
- Repository law: `SPEC.md` and `packages/app-server/SPEC.md` distinguish fixed `root-workspace` from mounted `public-workspace`; root-workspace may carry avatar-private env/runtime CLI and rewrite `HOME`.
- Repository law: runtime-local CLI/API descriptors own route, description, input schema, help, and examples for `attention`, `message`, `workspace`, `terminal`, `skill`.
- Existing implementation: `packages/app-server/src/runtime-cli.ts` builds root-workspace shell commands from runtime descriptors and custom commands.
- Existing implementation: `packages/app-server/src/runtime-local-api.ts` exposes loopback-local POST routes authenticated by the runtime avatar private key.
- Existing implementation: built-in skills live under package `skills/**/SKILL.md` and are aggregated into `packages/app-server/src/generated/runtime-skill-catalog.generated.ts`.
- Existing related change: `workspace-mounted-systems-and-attention-contexts` explores workspace-local file-backed system carriers, but it is broader and still future-facing.
- Official MCP research: the TypeScript SDK client guide documents `StdioClientTransport`, `StreamableHTTPClientTransport`, and `SSEClientTransport`; it also describes clients discovering tools/resources/prompts and invoking tools after connection.
- Official MCP research: MCP clients initialize a session, negotiate capabilities, and then discover server tools/resources/prompts via protocol calls. Therefore a useful global overview can come from the latest successful instance initialization snapshot.
- Official MCP research: `@modelcontextprotocol/server-sequential-thinking` is a real stdio MCP server suitable for acceptance because it exposes a stable sequential-thinking tool without depending on a project-specific external account.
- Official MCP research: the TypeScript SDK provides a `simpleSseServer.ts` example that can be used as a reliable local SSE fixture for legacy HTTP+SSE client transport acceptance.
- Claude/Codex/Gemini MCP usage patterns converge on named MCP server entries with transport config, install/add commands, list/get/status style inspection, and user/project-level scopes. Agenter should borrow the global install shape, but keep project enablement, process lifecycle, and project-local snapshots as its own system truth.

## External Sources

- MCP TypeScript SDK client guide: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md
  - Used for the client-side transport surface: Streamable HTTP, stdio, SSE fallback, disconnect behavior, tool/resource/prompt discovery, and tool invocation.
- Sequential Thinking MCP server package: https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking
  - Used as the required stdio real-server acceptance target.
- MCP TypeScript SDK simple SSE server example: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleSseServer.ts
  - Used as the preferred reliable SSE acceptance fixture when no stronger maintained public SSE server is selected during implementation.

## Architecture Diagnosis

`mcpSystem` is not a simple CLI wrapper. It introduces a new lifecycle and configuration owner:

- global truth: installed named MCP configs and transport config
- project truth: which explicit project paths enabled which global MCP names; missing enablement projects to disabled
- live session truth: one live MCP client session per enabled explicit project plus global MCP name
- capability projection: latest discovered tools/resources/prompts/server info, isolated by project/global config
- operator controls: global add/remove, project enable/disable/list, process start/stop/restart
- SQL query controls: read-only SQL over documented temporary `mcp_installed` and `mcp_enabled` tables
- invocation controls: tool use that respects `autoStart` and `autoEnable` gates
- AI guidance: a system skill that teaches when to auto-start, when to restart, and how to inspect help

This fits existing laws if it remains a runtime-local system behind root-workspace CLI/API. It conflicts with existing laws if it directly expands the model's provider tool list or if MCP instances become hidden prompt glue.

## Recommended Platform Law

### Option A: runtime-local mcpSystem atom

Add `mcp` as a descriptor-backed runtime-local namespace:

- install: `mcp add` for global config
- enable: `mcp enable` for exact project availability
- list: `mcp list` for enabled MCPs in an exact project
- query: `mcp query`
- invocation: `mcp call`
- lifecycle: `mcp start`, `mcp stop`, `mcp restart`
- management: `mcp add`, `mcp remove`, `mcp enable`, `mcp disable`, `mcp list`

All commands accept canonical JSON payloads or `--help`, following the runtime descriptor law. Each command requiring project scope must receive an explicit absolute project path. No parent/child path inheritance.

Public payloads should use `projectPath` for the exact normalized absolute project root path. Public conceptual words are `global` and `project`, but `add/remove` no longer accept a `scope` field because they are global-only.

`mcp query` is no longer a set of enumerated modes. It accepts read-only SQL over documented temporary tables named `mcp_installed` and `mcp_enabled`; `mcp query --help` is the schema source for AI.

### Option B: provider-level MCP catalog injection

Expose each MCP server tool directly to model providers that claim `mcpCatalog` capability. This would be convenient for providers with native MCP catalog support, but it violates the current minimal model surface and would make MCP availability provider-shaped instead of runtime-shaped.

Recommendation: reject Option B for this change. Native provider MCP support can later become a projection/export adapter fed by mcpSystem truth, not the primary authority.

## Closed Review Decisions

1. `mcp add` and `mcp remove` are global-only and do not accept `scope`.
2. `mcp enable` and `mcp disable` are project-facing and control project availability.
3. `mcp start`, `mcp stop`, and `mcp restart` are project-facing and control the concrete process/client session.
4. Global MCPs are disabled by default in every project.
5. `mcp list` is project-facing and lists enabled MCPs for the exact project, with global description and project-local snapshot when available.
6. `mcp call` defaults to `autoStart: true` and `autoEnable: false`.
7. `mcp disable` defaults to `stop: true`.
8. `mcp remove` defaults to `stop: false`.
9. `mcp query` uses read-only SQL over documented temporary tables `mcp_installed` and `mcp_enabled`.
10. mcpSystem persists durable facts in avatar-private SQLite storage.
11. `mcp query` uses named parameters only.
12. `mcp remove stop:true` uses the default remove failure as the practical confirmation step; no extra revoke confirmation field.
13. Public API language uses `project` and `global`; `projectPath` carries the exact normalized absolute project root path.
14. `mcp query` execution always returns JSON rows; no table/text output modes.
15. stdio, Streamable HTTP, and SSE are all first-implementation transports through official MCP TypeScript SDK client transports.
16. No separate secret-reference system in this change; env comes from root-workspace runtime env plus literal global/transport overlays.
17. Final acceptance must include real AI testing through MCP skill/help and root-workspace `mcp` CLI, using `@modelcontextprotocol/server-sequential-thinking` for stdio and a reviewed reliable SSE MCP target.

## Open Questions For Review

No open review questions remain from the current discussion. The next review pass should focus on whether the command names, table columns, and env overlay law are sufficiently small and intuitive for AI usage.

## Current Draft Direction

Create one new capability and two modified capabilities:

- New `mcp-system`: SQLite-backed global MCP registry, project enablement, two-table SQL query projection, live session lifecycle, project-local discovery snapshots, invocation.
- New `mcp-system-skills`: built-in skill guidance for AI usage and troubleshooting.
- Modified `runtime-json-tool-descriptor-surface`: add `mcp` namespace to descriptor-backed CLI/API law.
- Modified `runtime-skills-cli-surface`: root bash exposes `mcp`, skills list exposes mcp guidance, no direct model tool injection.
