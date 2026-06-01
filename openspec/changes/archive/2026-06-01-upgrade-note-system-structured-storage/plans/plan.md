# Intent Document

## Current Round

- Round: 1
- Status: Research-plan draft for NoteSystem upgrade before app-shell prompt/resource work.
- Previous plan backup: None.

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 我补充一下：
> -  npm:<package-name>/<relative-file> 这个优先理解成从package.json 的exports中寻址，找不到再用相对路径的思路去寻址
> - 目前的 shell-assistant-seeds.ts 这个要直接改成mdx文件，而不是用ts硬编码。其中的 SHELL_DEFAULT_AVATAR 变量的注入更是错误的，因为用户可能会继承这段提示词给Bob、Max、Jane 等自己的Avatar使用，准确做法应该是用`<Slot xx>`方式去注入变量，我记得我们是支持的.
> - 等你完成 app-shell 的升级后，使用 $skill-creator 去升级我们的 skills/create-agenter-app
> - ShellAssistant.mdx 中，关于noteSystem真确的使用，应该是明确在提示词中告知AI，用统一的笔记名`shell-assistant-book`，然后提供分区建议。你早期用memoryFiles定了`pairing-playbook.md/terminal-habits.md/self-evolution-log.md/hosting-objective.md` 这样的一个个文件，在noteSystem中可以变成分区。不过我对你之前这套设计并不满意。我给你我和gemini讨论的过程给你参考
>
> 我在开发一个 ShellAssistant （终端助手）Agent，它的作用是学习用户的习惯、了解用户的偏好、知晓用户的目标、和用户一起达成目标。
> 底层的元思维是：适应环境 -> 达成目标。
> 上层体现出来多种可能，比如：
> 1. 导师：发现用户是终端小白，那么就自己来解决问题，同时也需要向用户解释为什么这样做
> 2. 同学：发现用户有自己的想法，那么就发挥自己擅长的（博学）来和同学一起提出问题、探讨问题、解决问题
> 3. 助理：发现用户比自己更懂（虽然博学几乎不可能必过 AI，但是人类有目标有愿景有想象力），那么就学习用户的思维方式和习惯，辅助用户解决问题
> 4. 被定义的：用户可能会调教 AI 变成特定的性格和角色，比如成为一只猫、乔布斯 等等各种可能
> 5. 其它...
>
> 关键是，不论是主动定义还是被动定义，这些角色可能是动态的，在某个问题可能就是导师，在另外一个问题可能就是助理。甚至同一个问题里面也有可能切换不同的思维。
> 因此元思维的设计非常重要，它不能去拟合上层的可能，它的设计需要达成一种底层的驱动力，从而满足上层的各种可能。
>
> 现在在设计它的记忆系统。codex 初期给了这样的提示词：
> ```
> ## Memory pack
>
> Read and update these avatar-private memory roles when the evidence justifies it:
> - `user-model.md` for user-model
> - `pairing-playbook.md` for pairing-playbook
> - `terminal-habits.md` for terminal-habits
> - `self-evolution-log.md` for self-evolution-log
> - `hosting-objective.md` for hosting-objective
> ```
>
> 我很不满意，我觉得它无法满足“元思维”
> 请你重新设计，不要管什么 md 文件，你就直接将记忆系统进行分区设计，并解释每个区的作用，然后解释不同区如何协作，什么时候应该读取。每个区里面的文件应该如何命名（命名规则是什么）。还有随着时间的增加，AI 如何从海量的分区文件里面搜索自己需要的数据？毕竟 AI 是没有记忆的，它必须基于系统提示词从 0 开始去读取笔记文件。那么如何读取呢？
>
> 我对gemini的设计并不完全满意，但是它的思路对你有启发性。另外开始之前，我发现你对于noteSystem的设计存在异常问题。可以肯定的是:
> 1. note-cli 没有和 skill-cli、message-cli一样的架构设计，否则它的输入一定会是 JSON 的这种数据结构，并且和note-skills会有深度的融合绑定。这是一套统一的架构方式，请直接模仿学习
> 2. 我发现noteSystem自身没有提供 tags分组、references引用、rename重命名 这样的功能。其中tags分组功能很简单，但是要实现查询某一本笔记的tags，或者查询某一个分区的tags，并提供tags的查询能力。
> 2.1. 关于分组：这里的关键，是底层必须使用sqlite来存储，查询的时候，直接将底层数据库映射成一张临时表，让后提供SQL语句给AI进行查询（AI非常擅长写代码来解决问题，所以给SQL是最灵活的）；
> 2.2. 还有引用和重命名，这里的关键是，我们存储笔记文件的内容，本身是可以灵活存储的，比如存储成markdown格式或者json格式都是运行的，但是为了最大的自由，我们新增一个字段mime（默认是markdown），基于这个字段可以实现一些基本的脚本，比如是json的时候，我们写入的时候就可以压缩json并做语法检验。未来还可以存储二进制，比如直接存储视频、音频、图片，都是允许的，这时候的做法，就是写入的时候，提供一个文件路径来写入，而不是传入一个文件内容。
> 2.3. 完成了上诉这点的设计，我们的引用和重命名的功能就有了基础，引用本身是指向某一个笔记文件，这个在数据库里面的id是固定的，所以可以随意重命名，这里的关键，是在markdown中，我们需要解析出笔记的相关性，然后把它改成参考链接。或者有可能AI一开始就写了参考链接的格式，我们需要检验参考链接的正确性。
> 完成转换后，我们需要将它进一步提取成可以落地数据库 references 字段，但此时还不能落地数据库，因子段可能非法。
> 接着我们需要检测references字段的合法性，进一步将它转化成数据库内部的id。
> 比如说，我们知道 `./my-xxx.md` 这个时候它首先只是一个key，然后我们尝试理解这个key的含义，和我们的note进行关联，如果我成功将 `./my-xxx.md` resolve 到同个分区的某个文件、或者同一个笔记本的某个文件。这时候，我们需要将它标准化，变成 `note:<book>/<section>/<pageName>`，从而倒灌到markdown文件内。
> 而落地到数据库 references 的字段中，存储的会是更加底层的的信息：`{bookId、sessionId、pageId}`
> 以上是对markdown做了举例，是因为markdown我们可以解析，而json等其它我们就不能解析，必须让AI自己携带规范化的references字段，比如它可以直接携带`{bookId、sessionId、pageId}`，但也可以携带`note:<book>/<section>/<pageName>`，甚至也可以携带`./my-xxx.md`
> 我们写入成功后，会返回这个page最终的元数据信息信息，包括 bookId、sessionId、pageId、tagIds、createTime、updateTime、references... 等等
>
> 仍然是用openspec vision记录和推进，我上诉的内容有点多，你务必客观记录。
> 先完成对noteSystem的升级，这是基础。然后再回来做是app-shell

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | `npm:<package-name>/<relative-file>` should first resolve through `package.json` `exports`; if that fails, resolve by package-relative path. | Defer app-shell resource protocol until after NoteSystem, but keep this as later app-shell/resource-law requirement. |
| 1 | User | `shell-assistant-seeds.ts` must become an `.mdx` file; `SHELL_DEFAULT_AVATAR` injection is wrong because other avatars can inherit the prompt; variables should use Slot injection. | Later app-shell phase must remove TS-hardcoded prompt seed and use MDX + Slot variables. |
| 1 | User | After app-shell upgrade, use `$skill-creator` to upgrade `skills/create-agenter-app`. | Skill update is explicitly sequenced after app-shell, not before NoteSystem. |
| 1 | User | `ShellAssistant.mdx` should instruct AI to use one notebook named `shell-assistant-book` and recommend sections. | Later ShellAssistant prompt must be based on upgraded NoteSystem and use a unified notebook model. |
| 1 | User | Memory pack file names like `pairing-playbook.md`, `terminal-habits.md`, `self-evolution-log.md`, `hosting-objective.md` can become NoteSystem sections, but the previous design is unsatisfactory. | NoteSystem must support a richer section/tag/reference/search model before prompt guidance is finalized. |
| 1 | User | ShellAssistant's memory design should serve the meta-thinking `适应环境 -> 达成目标` and support dynamic roles such as mentor, classmate, assistant, user-defined persona, and context-switching. | NoteSystem and prompt guidance must not encode fixed personality modes as durable memory categories. |
| 1 | User | `note-cli` is not architected like `skill-cli` and `message-cli`; it should use JSON input structure and bind deeply with the note skill. | Convert note CLI toward descriptor/JSON-only runtime CLI law and update the note skill in the same change. |
| 1 | User | NoteSystem lacks tags grouping, references, and rename. | Add durable tags, references, and rename capability. |
| 1 | User | Tags must support querying tags for a notebook, querying tags for a section, and querying by tags. | Add tag catalog/query APIs and CLI commands. |
| 1 | User | Grouping requires sqlite storage; expose the database as temporary table(s) and provide SQL query capability to AI. | Add a SQLite-backed note index/query surface instead of file-scan-only projection. |
| 1 | User | Add `mime`, default markdown; JSON writes should validate and compact JSON; future binary writes should use file path input instead of content. | Expand note page metadata/content model beyond markdown-only body. |
| 1 | User | Markdown references should be parsed, normalized, validated, rewritten to `note:<book>/<section>/<pageName>`, and stored in database as stable internal ids. | Add markdown reference extraction/normalization plus database-level reference edges. |
| 1 | User | Non-markdown content cannot be parsed and must carry normalized references explicitly; accepted reference forms include internal IDs, `note:<book>/<section>/<pageName>`, and relative paths. | API must accept explicit reference metadata for non-markdown MIME types. |
| 1 | User | Successful write should return final metadata including `bookId`, `sectionId`, `pageId`, `tagIds`, `createTime`, `updateTime`, `references`, etc. | Write/read outputs must return durable identifiers and normalized metadata. |
| 1 | User | Use OpenSpec vision to record and advance; complete NoteSystem upgrade first, then return to app-shell. | This change is scoped to NoteSystem; app-shell work is a dependent follow-up. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/app-server/src/note-system/cli.ts` | `note` is a hand-written `just-bash` command with positional/flag parsing and optional `--json`; it is not backed by runtime tool descriptors. | Confirms user's diagnosis that note-cli diverges from descriptor/JSON runtime CLI law. |
| `packages/app-server/src/runtime-tool-descriptors.ts` | No `note` namespace descriptor exists; descriptors cover runtime JSON tool commands. | NoteSystem needs descriptor integration, not only more flags. |
| `packages/app-server/src/runtime-cli.ts` | Runtime shell injects `note` as a separate command beside descriptor-backed namespaces. | The current shape is a compatibility island. |
| `packages/app-server/src/note-system/storage.ts` | Storage is file-scan based under `<avatarHome>/notes/<notebook>/<section>/<page>.md`; IDs are path-derived. | Rename and stable references require a new stable ID/index layer. |
| `packages/app-server/src/note-system/markdown.ts` | Markdown frontmatter is a small ad-hoc parser; tags are JSON-string parsed; no references or MIME model. | Existing parser is insufficient for tags/reference/mime laws. |
| `packages/app-server/src/note-system/search.ts` | Search builds an in-memory MiniSearch index from up to 1000 scanned markdown pages. | SQL/table query and scale requirements need a persistent index. |
| `packages/app-server/src/note-system/surface.ts` | Studio/client surfaces expose catalog/page/search only. | Existing UI surface must grow, but should stay typed and read-only where appropriate. |
| `packages/app-server/SPEC.md` | NoteSystem is currently defined as Markdown/frontmatter raw-note atom and browser-facing typed surface. | Durable spec must be upgraded to sqlite-backed, MIME-capable note facts. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending |
| Normal archive | Commit containing `openspec archive <change>` result | Pending |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Pending |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/changes/complete-note-system-product-surface` archive | Completed the first NoteSystem product surface: CLI, skill, backend projections, client-sdk, Studio route. | Extend, but current change is a breaking capability upgrade. |
| `packages/app-server/SPEC.md` NoteSystem bullets | Notes are Markdown/frontmatter files, CLI strict writes, read/search typed projection. | Break/upgrade: keep raw-note intent, replace storage/index and expand metadata. |
| `packages/client-sdk/SPEC.md` NoteSystem facade law | Studio consumes typed client facades, not app-server filesystem internals. | Extend for tags/page metadata/references/SQL query. |
| Runtime tool descriptors | JSON-only runtime CLI law and structured help surface. | Reuse for note CLI; note should become a runtime tool namespace. |
| Skill system | Package-owned skills are cataloged from `skills/**/SKILL.md`. | Reuse for note skill update and future create-agenter-app skill update. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `适应环境 -> 达成目标` | ShellAssistant's core drive; note design should support dynamic adaptation, not static categories. | The notes must help the agent infer situation and act toward goals. |
| `元思维` | Lowest-level cognitive law that should generate many upper-level roles. | Do not hard-code mentor/classmate/assistant as fixed modes. |
| `笔记本 -> 分区 -> 页面` | User's preferred note hierarchy. | Notebook/book, section, page. |
| `shell-assistant-book` | Required unified notebook name for ShellAssistant prompt guidance. | One notebook for ShellAssistant facts. |
| `tags分组` | Tag-driven grouping/filtering/query across notebook and section scopes. | Tags are durable facts, not just frontmatter strings. |
| `references引用` | Note-to-note relationships resolved to stable IDs. | Human-readable links should become stable database edges. |
| `rename重命名` | User-visible names can change while database IDs and references remain stable. | IDs are identity; paths/names are labels. |
| `直接将底层数据库映射成一张临时表，让后提供SQL语句给AI进行查询` | AI-facing flexible query surface over note facts. | Give the agent SQL access over bounded note views. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None yet | No spike created in research round. | N/A |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should `sessionId` in `{bookId、sessionId、pageId}` mean `sectionId`? | User earlier hierarchy is notebook/book -> section -> page; `sessionId` may be a typo or intentional runtime session link. | Treat as `sectionId` in NoteSystem, while optionally preserving `sourceSessionId` later if runtime sessions become references. |
| Should old markdown note files be migrated automatically? | SQLite IDs and MIME metadata can be built from existing files, but automatic rewrite may mutate user assets. | Build index lazily and avoid destructive rewrite unless a write/rename/reference-normalization command explicitly updates a page. |
| Should SQL query be read-only only? | Letting AI write SQL would bypass strict note laws. | SQL surface is read-only SELECT over temporary/views only. |
| Should binary note storage ship now or only API shape? | User mentions future binary allowance; implementing binary storage fully may expand scope. | Implement MIME and file-path write plumbing with safe copy for binary-like content only if tests stay contained; otherwise spec the law and implement markdown/json first. |

## Intent

### Surface Intent

Upgrade NoteSystem before app-shell work so ShellAssistant can rely on a real notebook system rather than legacy memory-pack files or a simplistic markdown-only note CLI.

### Underlying Drive

The user is pushing NoteSystem from a convenience raw-recording surface into a platform atom with stable identity, searchable structure, SQL-shaped query flexibility, normalized references, MIME-aware content, and AI-facing CLI/skill contracts aligned with other runtime systems. This is a platform-law upgrade, not a local prompt wording change.

### Final Visible Effect

An operator can ask the runtime `note` CLI/skill to write, tag, rename, reference, search, and query notes under `AVATAR_HOME` with stable IDs. Studio can browse note metadata, tags, and references without reading files directly. ShellAssistant can later tell AI to use the single `shell-assistant-book` notebook with meaningful sections and trust that tags, references, and renames will remain coherent.

## Platform Diagnosis

- Current platform laws: NoteSystem is AVATAR_HOME-gated, Markdown/frontmatter-backed, strict on append/override, and visible through typed catalog/page/search projections.
- Does this fit as a regular atom: No. Tags alone would fit, but stable references, rename, MIME, SQL query, and descriptor-backed CLI require a storage and command-law upgrade.
- Does this require law upgrade: Yes. Note facts need stable database IDs and a SQLite-backed projection/index while preserving file content as human/audit artifacts.
- Breaking update stance: Prefer breaking API/CLI update over preserving ad-hoc positional flags, but keep a minimal compatibility layer only if tests prove existing flows need it.
- User confirmations still required: Destructive migration/rewrites, full binary support scope, and whether `sessionId` means `sectionId`.

## Reverse-Inferred Design

### Interaction / Visual Story

The AI starts without memory. It calls `note` help/skill, sees a JSON-command namespace, writes facts into `shell-assistant-book`, tags pages, searches by tags/text/SQL, and receives normalized page metadata with stable IDs. When a page links to another note, markdown links are normalized to `note:<book>/<section>/<page>` and the database stores reference edges by IDs, so rename does not break relationships.

### Interface Shape

- Runtime CLI should expose `note` as JSON-only descriptor-backed commands, matching runtime tool namespace conventions.
- Commands should include at least write/draft/show/list/search plus new tags, query, rename, and reference-aware metadata.
- Write accepts `mime`, content body or source file path, tags, references, and conflict mode.
- Successful writes return stable IDs and normalized metadata.
- Skill guidance should tell AI how to use `note` with JSON inputs and how to structure ShellAssistant notes later.

### Data Shape

- Durable identity: `bookId`, `sectionId`, `pageId`, tag IDs, reference edges.
- Human labels: notebook/book name, section name, page name. Rename mutates labels/path, not identity.
- Content facts: MIME, body/path/blob metadata, created/updated timestamps, source workspace.
- Projection facts: catalog, page, search, tags, references, SQL result rows.
- File artifacts: markdown/json/binary files remain readable artifacts but no longer define identity alone.

### Architecture Shape

- `note-system` owns storage, ID generation, SQLite index, file materialization, reference normalization, and query views.
- Runtime tool descriptors own AI-facing CLI shape; `runtime-cli` projects note only when `AVATAR_HOME` exists.
- Studio/client-sdk consume typed routers only.
- ShellAssistant prompt consumes NoteSystem later; NoteSystem must not import shell/app code.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Existing file migration rewrite | Rewriting markdown references mutates user-owned notes. | Index existing files read-only; rewrite only on explicit write/rename. |
| Binary storage completeness | Full binary UI/preview/upload is larger than current NoteSystem. | Implement MIME field and safe file-path write API only if scoped; defer rich binary UI. |
| `sessionId` naming | Could be typo for `sectionId` or a runtime session reference concept. | Use `sectionId` for hierarchy identity. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should SQL query support joins over references/tags out of the box? | It defines the query view shape. | Provide views for pages, tags, page_tags, references. |
| Should note URI use display names or stable IDs in markdown? | User requested `note:<book>/<section>/<pageName>` in markdown but DB stores IDs. | Markdown uses readable note URI; DB stores ID edges. |
| Should `draft` remain `_draft` notebook or become a section in `shell-assistant-book`? | Existing draft law uses special notebook. | Keep `_draft` generic; ShellAssistant prompt can prefer `shell-assistant-book` sections for intentional notes. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep positional `note write --notebook ...` as the primary AI contract | User explicitly identified it as inconsistent with skill/message CLI architecture. |
| Only add tags to frontmatter | Does not solve tag query, rename, references, SQL, or stable IDs. |
| Let ShellAssistant prompt paper over NoteSystem gaps | User explicitly ordered NoteSystem upgrade first as the foundation. |
| Store references only as markdown links | Rename would break link identity and SQL/reference queries would stay unreliable. |

## Exit Conditions

- Default max review iterations: 2 implementation/self-review loops before escalating residual risks.
- Issue recurrence threshold: If the same storage/CLI architectural mismatch appears in two review loops, pause and update specs before more code.
- Custom exit condition from intent: Do not resume app-shell `ShellAssistant.mdx` work until NoteSystem has descriptor-backed CLI, tags, references, rename, stable IDs, MIME-aware write path, SQL query surface, updated note skill, client/studio/router coverage, and passing targeted BDD verification.
