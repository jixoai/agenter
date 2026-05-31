# Intent Document

## Current Round

- Round: 1
- Status: Research-plan drafted from repo evidence; specs and tasks not yet generated.
- Previous plan backup: none

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

> 我们现在专注于打磨 app/shell 这个产品。从这个产品的打磨作为起点，完善内核，进而完善产品。
>
> ### 产品入口这部分
>
> 我希望改进一下使用体验：在选中已有的shell后，直接进入，不再选择Avatar。之前是想能通过这种方法添加其它Avatar到对话中来(或者之前可能做成的是新开一个room？），现在我觉得没必要，因为：
>
> 1. 我们可以在Chat对话框中，新增 /avatar 这个命令面板，实现管理房间用户的功能
> 2. 现在Terminal和Room是1-1的绑定关系
>    > 原本这个旧流程可能有一些隐晦的老流程，好好检查一下，确保我们的架构流程是干净清晰的
>
> 接着就是“选择Terminal”这个面板，改进一下样式和内容：
>
> 1. 用不同的颜色区分字段
> 2. 新增字段展示房间内的其它人：`@AAA @BBB` 排除当前的superadmin
>
> > 使用openspec vision进行推进。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | `app/shell` is the current product focus; product polish should expose and improve kernel laws. | Treat this as a product-law change, not isolated text styling. |
| 1 | User | Selecting an existing shell should enter directly and should not select Avatar. | Remove the interactive Avatar step from existing Terminal entry. |
| 1 | User | Avatar room-user management should move to Chat `/avatar` command panel. | Entry must stop being the hidden user-management path; leave room-user management to a Chat command surface. |
| 1 | User | Terminal and Room are now 1-1 bound. | Navigation must model Shell entry as one Terminal with one bound Room, not as a free Avatar/session chooser. |
| 1 | User | The old flow may contain hidden legacy behavior; inspect it and make architecture clean. | Audit app attach, navigation, app binding, Terminal grants, Room grants, and shell metadata. |
| 1 | User | The "Select Terminal" panel should use different colors to distinguish fields. | Improve row projection with structured field styling, not a single flat string. |
| 1 | User | The panel should show other room people as `@AAA @BBB`, excluding current superadmin. | Navigation model must join Terminal row projection with bound Room participants and current auth identity. |
| 1 | User | Use `openspec vision` to advance. | Use `vision-driven` artifacts with `plans/plan.md` as SSOT. |
| 2 | User | `continue` | Continue from research-plan creation into the vision-driven flow. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `package.json` | `openspec:vision` runs `scripts/openspec/vision-driven.ts`. | Confirms the requested workflow schema is active in this repo. |
| `openspec/schemas/vision-driven/schema.yaml` | `research-plan -> specs -> tasks -> self-review`; current SSOT is `plans/plan.md`. | Defines the artifact order and evidence law. |
| `apps/shell/src/app-runtime/runtime.ts` | `ensureAttachSelection` invokes `startNavigationTui` when `--session` or `--avatar` is missing, with `needsShell` and `needsAvatar` tracked separately. | This is the product entry gate that currently forces Avatar selection. |
| `apps/shell/src/app-navigation/navigation-app.ts` | Navigation state is two-step: `shell` then `avatar`; after Shell confirm it switches to `avatar` if `needsAvatar` is true. | Confirms the old UX path is explicit and removable. |
| `apps/shell/src/app-navigation/navigation-model.ts` | Shell rows are built from live GlobalTerminal entries whose metadata matches `appId=shell`, `ownerSystem=terminal-system`, and canonical `resourceKey=shell-N`. | The product entry already starts from Terminal truth, but the UI still names it Shell and then asks Avatar. |
| `apps/shell/src/app-runtime/bootstrap.ts` | `bootstrapShellRoom` ensures a runtime for selected Avatar, then ensures Terminal binding and Room binding with the same `resourceKey`; it issues terminal/room grants to the selected avatar actor. | The old flow can silently grant another Avatar to the same bound Terminal/Room, matching the user's concern. |
| `packages/client-sdk/src/app-runtime.ts` | `ensureTerminalBinding` and `ensureRoomBinding` find resources by `appId + resourceKey + ownerSystem`; `resourceKind` is input contract but not part of `matchesAppBindingMetadata`. | Terminal and Room 1-1 pairing is currently emergent by shared key, not a single queryable binding atom. |
| `packages/app-runtime/SPEC.md` | App-owned resource binding law is `appId + resourceKey + resourceKind`; authority remains in TerminalSystem / MessageSystem / AvatarRuntime / AttentionSystem. | The fix should improve Shell binding projection without moving durable truth into Shell UI. |
| `apps/shell/SPEC.md` | Shell must keep Terminal truth in TerminalSystem, Room truth in MessageSystem, and bind them through app metadata/resource keys. | Confirms direct entry should be a Shell product projection over system truths. |
| `packages/terminal-system/src/terminal-control-plane.types.ts` | Terminal entries expose `access` and `actors` as terminal seat projections. | Terminal participants can help derive row metadata and future direct-entry identity repair. |
| `packages/app-server/src/trpc/router.ts` | Superadmin auth scope becomes `superadminContactId` / `superadminActorId` rather than ordinary room/terminal participant actor. | "Exclude current superadmin" must use auth scope, not string guesses. |
| `packages/message-system/src/types.ts` and room-management OpenSpec history | Room participants are durable seat membership facts, not control authority. | The row's people field should display room participants and exclude superadmin control identity. |
| `openspec/changes/replace-cli-shell-with-shell-next-product-runtime/*` | Shell app runtime parity already established daemon/client-sdk attach, live TerminalSystem source, Room surface, statusbar facts, and no tmux fallback. | Reuse the app-runtime path; do not revive legacy tmux shell behavior. |
| `openspec/changes/rework-shell-next-terminal-interaction-ownership/design.md` | Shell/OpenCompose should remain presentation and event routing; lower systems own terminal interaction truth. | Keep this change at product entry and binding projection, not terminal backend behavior. |
| `openspec/changes/decouple-room-management-from-message-system/design.md` | Room management separates control authority from room participants; superKey/control is not a member seat. | Supports excluding current superadmin and moving user management out of entry. |

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
| `replace-cli-shell-with-shell-next-product-runtime` | Shell app attach uses daemon/client-sdk resources and live TerminalSystem transport. | Reuse. |
| `refine-shell-next-interactions` | Product interaction polish becomes reusable shell affordance primitives, not per-surface string hacks. | Reuse for field-color row rendering. |
| `rework-shell-next-terminal-interaction-ownership` | Shell app layer must not take over terminal backend interaction truth. | Preserve; this change is entry/binding projection only. |
| `decouple-room-management-from-message-system` | Room participation is separate from superadmin control authority. | Extend into the Select Terminal row and direct-entry flow. |
| `align-avatar-memory-scope-law` and root `SPEC.md` avatar-first runtime law | AvatarRuntime identity is avatar-first and prompt/memory truth is principal-root based. | Preserve; do not erase Avatar identity, only remove it from entry selection for existing bindings. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `app/shell 这个产品` | The active Shell app package under `apps/shell`, not `apps/shell-old`. | Product surface and its app-runtime attach path. |
| `产品入口` | Interactive startup path before the Shell UI opens. | `ensureAttachSelection` + navigation TUI. |
| `已有的shell` | Existing live Shell-bound Terminal resource, with a 1-1 Room binding through the same resource key. | A GlobalTerminal row for `appId=shell` / `resourceKey=shell-N`. |
| `不再选择Avatar` | Existing entry should not ask "which Avatar should join/use this room" after Terminal selection. | Entry selects a binding, not a participant. |
| `/avatar 命令面板` | Chat-local user/Avatar management command surface. | Future room-user management UI inside Chat composer command mode. |
| `Terminal和Room是1-1的绑定关系` | Shell product identity is the pair of one Terminal and one Room. | Product binding projection should expose the pair as one entry. |
| `隐晦的老流程` | Existing side effects such as silently issuing grants or creating a new runtime/room through Avatar selection. | Hidden legacy behavior that must be named and removed or isolated. |
| `选择Terminal` | The startup list should be Terminal-centric, even if current code says Shell. | Rename UX and shape rows around terminal facts plus bound room facts. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none yet | Current code and tests are enough for the first plan. | No spike required before specs. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should this change implement the full Chat `/avatar` command panel now, or only remove entry-level Avatar selection and leave `/avatar` as the next change? | `/avatar` can become a separate room-management capability with more UX and permission rules. Bundling it may enlarge this entry polish change. | Do not implement full `/avatar` now; reserve the command surface and ensure entry no longer acts as user management. |
| For a legacy existing Shell binding that lacks persisted owner Avatar metadata and has multiple non-superadmin participants, should direct entry choose a deterministic owner or show a repair prompt? | Direct entry needs to know which AvatarRuntime/session backs status and Chat send identity. Guessing could create invisible identity drift. | Add explicit legacy detection: direct-enter only when owner Avatar can be resolved; otherwise present a small repair/selection path rather than silently granting/creating. |
| Should the panel label be `Select Terminal` immediately, replacing `Select Shell`? | User named the panel as Select Terminal and the law is Terminal/Room 1-1. | Rename the panel and rows to Terminal-centric language. |

## Intent

### Surface Intent

When the operator starts `agenter shell` without full explicit flags, the first product screen should be a clean "Select Terminal" surface. Selecting an existing Shell-bound Terminal should enter that Terminal/Room pair immediately. It should not ask for an Avatar afterward and should not use entry as a hidden way to add an Avatar to the Room.

Rows should be readable at a glance: different fields use distinct colors, and each existing Terminal row shows other Room people as `@AAA @BBB`, excluding the current superadmin identity.

### Underlying Drive

The deeper pressure is to stop treating product startup as a disguised room membership mutation. Shell entry should select a product resource binding. Room user management belongs in the Chat surface because it is a Room concern. Terminal and Room remain authoritative in their systems; Shell owns only the product projection and local OpenTUI presentation.

### Final Visible Effect

The operator opens `agenter shell`, chooses an existing Terminal row, presses Enter or clicks, and lands directly in the Shell UI. No Avatar list appears. The selected row already tells them enough to distinguish entries: shell key, terminal state/title/path, and other room participants. If an old binding cannot be safely mapped to its runtime/avatar identity, the UI explains that as a legacy repair state instead of silently making a new actor grant.

## Platform Diagnosis

- Current platform laws:
  - Terminal truth belongs to TerminalSystem.
  - Room truth belongs to MessageSystem / room-management.
  - AvatarRuntime identity remains avatar-first.
  - Shell binds terminal and room resources through app metadata/resource keys.
  - Shell UI/opencompose owns presentation, not terminal or room authority.
- Does this fit as a regular atom: No. The row styling is a regular UI atom, but the direct-entry behavior exposes that current startup still conflates resource selection with Avatar participant selection.
- Does this require law upgrade: Yes, at the Shell product binding projection level. Shell entry must become Terminal/Room binding selection; Avatar participant management moves out of entry.
- Breaking update stance: Prefer the clean break for interactive entry. Existing CLI explicit `--avatar` remains a compatibility/intentional creation path, but interactive existing-terminal entry must not auto-add Avatar grants.
- User confirmations still required:
  - Whether to include full Chat `/avatar` command panel in this same change.
  - How aggressively to repair ambiguous legacy bindings that lack resolvable owner Avatar metadata.

## Reverse-Inferred Design

### Interaction / Visual Story

The startup screen is a compact operator list, not a setup wizard:

1. Header: `Select Terminal`.
2. Row 1 remains `+ New Terminal` or equivalent creation affordance.
3. Existing rows show structured fields:
   - shell key / resource key;
   - process phase / status;
   - terminal title;
   - cwd/path or terminal id fallback;
   - people: room participants as `@nickname` tokens, excluding current superadmin.
4. Selecting an existing row completes entry immediately.
5. Selecting `New Terminal` uses the default Shell assistant unless explicit CLI/avatar creation flags specify another Avatar. Future `/avatar` handles adding more room users after entry.
6. Ambiguous legacy rows should surface a repair state instead of hidden mutation.

### Interface Shape

- Navigation model should expose a `ShellNavigationTerminalItem`, even if the internal resource key remains `shellName` for compatibility.
- Existing terminal items should carry:
  - `shellName`;
  - `terminalId`;
  - terminal title/status/path;
  - `roomId` when a bound room is found;
  - `otherRoomParticipantMentions`;
  - direct-entry readiness / legacy-repair reason.
- Navigation selection should distinguish:
  - existing terminal entry: direct complete with `shellName` and resolved binding identity;
  - new terminal creation: create with explicit/default Avatar identity.
- Entry should not call Avatar catalog UI after an existing Terminal selection.

### Data Shape

Durable facts:

- Terminal entry metadata: app binding resource key and TerminalSystem state.
- Room entry metadata: same app binding resource key and MessageSystem participant facts.
- Avatar principal/runtime identity: AvatarRuntime truth, not navigation-local state.

Projections:

- "Select Terminal row" is a product projection joining Terminal + bound Room + current auth identity.
- `@AAA @BBB` is display-only mention formatting over room participants, not a new participant truth.
- "Direct entry readiness" is a Shell projection over whether the existing binding has enough identity evidence to attach without making new grants.

Facts not to confuse:

- Superadmin control identity is not a room participant just because it can manage/read.
- Avatar nickname is not terminal identity.
- `resourceKey=shell-N` is product binding identity, not TerminalSystem id.

### Architecture Shape

Recommended option A: Shell binding projection law.

- Add a small Shell-owned binding projection layer under `apps/shell/src/app-navigation/` or `apps/shell/src/app-runtime/`.
- It joins TerminalSystem and MessageSystem rows by Shell app binding metadata.
- It resolves current superadmin from auth session.
- It formats the navigation model as Terminal-centric rows.
- It prevents existing-terminal selection from issuing new Avatar grants.
- It keeps app-runtime and core systems generic.

Option B: Keep the old two-step wizard and hide Avatar selection when convenient.

- This would patch `needsAvatar=false` in some UI paths while `bootstrapShellRoom` still uses selected/default Avatar to grant Terminal/Room access.
- It would preserve hidden participant mutation and make row people display cosmetic.
- It breaks the user's 1-1 Terminal/Room mental model and keeps entry as user management.

Decision: pursue option A. Option B is rejected as architecture debt.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Full `/avatar` command panel in this change | It is a separate room-management UX surface with command parsing and grant mutation responsibilities. | Defer full implementation; only reserve the architecture path. |
| Legacy ambiguous binding repair | If an existing Terminal/Room pair has multiple non-superadmin participants and no owner metadata, direct entry cannot infer the backing AvatarRuntime safely. | Do not silently choose; show/record a legacy repair path and keep explicit CLI flags available. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Is `/avatar` in scope now? | It can double the change size by adding a new Chat command panel and room user management flow. | Out of scope for this change; direct entry should make room for it. |
| Should direct entry be allowed for old rows with unresolved owner Avatar? | Runtime/session identity affects status, attention, and message sender. | No silent attach; require deterministic identity or explicit repair. |
| Should the "New Terminal" flow also skip Avatar selection entirely? | User's exact wording was "existing shell", but the new law suggests entry should be Terminal-centric overall. | New Terminal uses default Shell assistant unless explicit Avatar flags are supplied. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep Avatar selection after existing Terminal selection | It keeps entry as hidden room-user management and can silently issue grants. |
| Default to Shell Assistant for every existing Terminal | It can attach the wrong AvatarRuntime and add a new participant to an existing Room. |
| Render people by scanning message authors only | Room participants are durable seat facts; transcript authors are history, not current membership. |
| Move Terminal/Room binding truth into Shell UI state | TerminalSystem and MessageSystem must remain truth owners. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2 consecutive rounds
- Custom exit condition from intent: Existing Terminal selection enters Shell directly with no Avatar screen, the Select Terminal row exposes structured/color-distinguished fields and other room people excluding current superadmin, and tests prove no hidden Avatar grant is issued during existing-terminal entry.
