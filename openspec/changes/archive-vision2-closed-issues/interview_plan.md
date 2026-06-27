# Interview Plan

## Original User Input

> 给 vision2 加一个命令，把已经 closed 的 issue 文件归档到 issues/closed/ 目录下。参考 develop-tasks 里 archive-closed-issues.ts 的做法。要能通过 check。

## Q&A Ledger

无法与真实用户交互，以下为遵循 grilling 方法（一次一问、给推荐答案、代码能查先查）的自采访记录。标 ASSUMPTION 的条目为待用户确认的推断，不得固化成事实。

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ----------------- | ---------------- |
| 1    | User    | 原话：见上方 "Original User Input"。 | 需要：一个归档 closed issue 的命令；参考 develop-tasks 的 archive-closed-issues.ts；必须通过 check。 |
| 2    | AI      | 问：归档应该在 check 里自动跑，还是独立命令？推荐答案：独立显式命令。理由：durable spec vision2-openspec-workflow 把 check 定位为"校验 + 收敛信号"，check 不得产生写副作用（它的契约里 check 只读 issue 文件统计 open 数，从不移动文件）。把归档塞进 check 会破坏 check 的非副作用契约。 | 命令形态确定为独立 subcommand；check 保持只读。**ASSUMPTION**：用户同意 check 不做归档。 |
| 3    | AI      | 问：用哪个字段判断 issue 已 closed？推荐答案：`github_issue_status: closed` 为主，同时认可 `state: closed`/`resolved`。查 `scripts/openspec/utils/issues.ts` line 32 的 ALLOWED_FRONT_KEYS、line 85-86 的 state 枚举、line 88 的 github_issue_status 枚举，以及 `collectIssues` line 130 把 `state === "open"` 算作活跃、其余算作非活跃。所以"非 open"（closed/resolved）就是可归档集合。 | 判定真源是 front matter；归档条件 = `state !== open`（含 closed/resolved）。 |
| 4    | AI      | 问：closed 文件移到哪里？推荐答案：`issues/closed/`。查 `scripts/openspec/utils/issues.ts` line 135、164，`collectIssues`/`validateIssues` 都显式跳过 `issues/closed/` 子目录（用 `join(issuesDir,"closed")` 做路径包含判断）。这正是 develop-tasks 的 archive 约定：closed 文件进同级 `closed/` 后就退出活跃查询。 | 目标目录 `issues/closed/`，且移进去后自动被 check 的 open-issue 统计排除。 |
| 5    | AI      | 问：`issues/closed/` 不存在怎么办？推荐答案：创建它。查 `utils/handoff.ts` / `versioned-doc.ts` 的惯例是 `mkdir(..., {recursive:true})`。 | 命令需保证目录存在。 |
| 6    | AI      | 问：要不要递归进嵌套子目录找 issue？推荐答案：不递归，只处理顶层 `issues/NNN-*.md`。查 `issues.ts` 的 `collectIssues`，issue 文件约定是平铺在 `issues/` 下（除 `closed/` 外），不存在嵌套 issue 约定。 | 归档只扫顶层 `issues/*.md`。 |
| 7    | AI      | 问：CLI 表面是什么样？推荐答案：`bun run openspec:vision2 -- issues <change> --archive`（给现有 `issues` 命令加 `--archive` flag）。理由：现有 `issues` 命令已经有 `--validate` flag 做校验，归档是 issue 生命周期的相邻动作，归到同一个命令下比新增顶层命令更内聚。 | 形态：`issues <change> --archive`。**ASSUMPTION**：用户接受 flag 形态而非新顶层命令。 |
| 8    | AI      | 问：没有 closed issue 时怎么办？推荐答案：幂等 no-op，exit 0，报告 "nothing to archive"。理由：归档应当可安全重复运行。 | 无 closed issue 时 exit 0 + 报告。 |
| 9    | AI      | 问：归档要不要改文件内容（如重写 front matter）？推荐答案：不改，纯 move。理由：archive 的语义是移动证据位置，不是改写证据；develop-tasks 的 archive-closed-issues.ts 也是纯 move（用户原话"参考它的做法"）。 | 纯 `rename`/`copyFile`+unlink，不动 front matter。 |
| 10   | AI      | 问：归档命令本身要不要被 check 调用？推荐答案：不调用，但 check 输出里要提示"有 N 个 closed issue 可归档"作为软提示。理由：check 保持只读，但可以告知用户下一步建议。**ASSUMPTION**：用户接受 check 只提示不执行。 | check 报告 closed 数；归档由用户显式触发。 |

## Evidence Read

| Source (file / change / spec) | Fact | Why it matters |
| ----------------------------- | ---- | -------------- |
| `scripts/openspec/vision2-driven.ts:195-291` | `checkChange` 校验 schema、artifacts 存在、toc 脚注覆盖、issue 结构、open-issue 数；全程只读，从不移动文件。 | 证明 check 契约是非副作用的，归档不能塞进 check（Q2）。 |
| `scripts/openspec/utils/issues.ts:32` | `ALLOWED_FRONT_KEYS = {title, state, github_issue_status, label, milestone, resolution}`。 | issue front matter 字段真源。 |
| `scripts/openspec/utils/issues.ts:85-86,88` | `state ∈ {open,resolved,closed}`，`github_issue_status ∈ {open,closed}`。 | closed 判定字段枚举。 |
| `scripts/openspec/utils/issues.ts:130` | `collectIssues` 把 `state === "open"` 算活跃，其余算非活跃（用于 open-issue 统计）。 | 归档条件 = 非 open。 |
| `scripts/openspec/utils/issues.ts:135,164` | `collectIssues`/`validateIssues` 用 `file.includes(join(issuesDir,"closed"))` 跳过 `issues/closed/` 子目录。 | `issues/closed/` 是 closed issue 的归档地，移进去即退出活跃统计（Q4）。 |
| `openspec/specs/vision2-openspec-workflow/spec.md` Requirement "Iteration findings SHALL be recorded as GitHub-style issue files" | "Closed or resolved issues SHALL be archived under `issues/closed/`"。 | durable spec 已规定 closed issue 归到 `issues/closed/`，本命令是把这条契约落成可执行机制。 |
| `vision2-driven.ts:155-188`（`listOrValidateIssues`） | 现有 `issues` 命令支持 `--validate` flag；无 flag 时 list。 | CLI 表面已有 flag 惯例，`--archive` 是自然延伸（Q7）。 |
| 仓库内搜 `archive-closed-issues` | 字面量零命中；develop-tasks 的 archive-closed-issues.ts 不在本仓库。 | "参考"对象是概念性的（纯 move 到 closed/），需按本仓库的 issues.ts 约定落地，不能照抄外部脚本。 |

## User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| 归档 (archive) | 把已完成的 issue 文件移动到 closed/ 目录 | move closed issue files into issues/closed/ |
| closed 的 issue | front matter 标记为 closed/resolved 的 issue | issue with state != open |
| 通过 check | `bun run openspec:vision2 -- check <change>` exit 0 | controller proof gate passes |
| 参考的做法 | 纯 move 的归档语义（不重写内容） | archive = file relocation, no content mutation |

## Intent

### Surface Intent

给 vision2 controller 加一个命令，把 closed/resolved 的 issue 文件归档到 `issues/closed/`，使它们退出活跃 issue 统计，且命令本身能通过 check（不破坏现有契约）。

### Underlying Drive

vision2 用 issue 的 `state` 驱动迭代出口判定（有 open → 继续；全 closed → 可出口）。但 closed issue 如果一直留在 `issues/` 顶层，会让 issue 列表和证据越来越臃肿，也模糊"当前还在迭代哪些问题"。需要一个生命周期收尾动作：把已闭环的发现移到 `issues/closed/`，让活跃集合始终清晰，归档证据保留可追溯。

### Final Visible Effect

运行 `bun run openspec:vision2 -- issues <change> --archive` 后：所有 `state !== open` 的 issue 文件移到 `issues/closed/`，命令报告移动了哪些文件；再次运行幂等 no-op；随后 `check` 的 open-issue 统计自然排除这些文件，issue 列表清爽。后端纯文件操作，证据是 `git status` 显示的文件移动。

## Open Questions

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| CLI 用 `--archive` flag 还是新顶层 `archive` 命令？ | 影响命令表面和文档；flag 更内聚，顶层命令更显眼。 | ASSUMPTION：用 `issues <change> --archive` flag。 |
| check 是否应在有 closed 未归档 issue 时提示？ | check 只读，提示是软引导非强制。 | ASSUMPTION：check 输出 closed 数作软提示，不自动归档。 |
| 归档后是否需要 commit 提示（像 commit-check）？ | 影响是否要给归档命令配 commit evidence。 | ASSUMPTION：归档命令只移动文件，commit 由用户显式做。 |

## Decisions

| Decision | Confirmed by | Reversible? |
| -------- | ------------ | ----------- |
| 归档是独立 `issues --archive` flag，不进 check | AI inference (ASSUMPTION) | Yes |
| 判定字段：`state !== open` | codebase evidence (issues.ts:130) | No (真源) |
| 目标目录：`issues/closed/` | durable spec + codebase | No (真源) |
| 纯 move，不改 front matter | user 原话"参考 develop-tasks 做法" | Yes |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| 在 check 里自动归档 | 破坏 check 的只读契约（vision2-driven.ts:195-291 全程不写文件）。 |
| 递归嵌套子目录找 issue | 无嵌套 issue 约定（issues.ts 的 collectIssues 只处理平铺文件）。 |
| 归档时重写 front matter 加 archived 时间戳 | 超出"参考 develop-tasks 纯 move"的范围，且增加内容变更风险。 |
| 新增顶层 `archive` 命令 | 与现有 `issues` 命令职责重叠，flag 更内聚。 |

## User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| CLI 形态（flag vs 顶层命令） | 影响 operator 肌肉记忆和文档 | 默认 `issues --archive` flag |
| check 是否提示 closed 数 | 影响 check 输出语义 | 默认提示，不自动归档 |
