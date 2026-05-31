# Intent Document

## Current Round

- Round: 1
- Status: research-plan updated after user selected Option A and added constraints; no implementation started
- Previous plan backup: `plans/plan-v1.md`

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

> 接下来，我们需要好好讨论成吨的focus attentionContext的问题。开个change来用openspec vision记录讨论：
>
> 1. 我之前有有个提案，是关于terminal一旦被killed，对应的attentionContext需要被变成muted。应该是这周的一个提案，你找找
> 2. 我记得很早之前，我有提出一种uri的格式，可以全局标记某一个terminal、room等实例，找一下相关的提案，再找一下代码的完成程度
> 3. 我目前的想法是 在shell-next 这个应用这里实现 terminalInstance 绑定 roomInstance。具体的影响就是：如果terminalInstance被killed：那么对应的attentionContext会被muted，这是内核行为；然后对应的roomInstance会被archive，这是shell-next的应用行为；接着roomInstance对应的attentionContext会被muted，这也是内核行为。要实现这个链路，我们还缺什么？

> 采用A的路线，但是有一些补充讨论：
> 1. 我们已经从messageSystem中分离出 roomManagement，那么`msg:`是否要分割成`msg:`+`room:`呢？不用考虑向下兼容，只讨论分割后到设计会有什么含义什么好处什么坏处
> 2. 我们需要在shell-next这里拿到真正的roomInstance、terminalInstance内存实例，并它们的lifecycle+api实现逻辑硬绑定。所以如果缺乏相关的lifecycle+api，那么我们还得讨论一下相关的设计。如果已经有了，那么也要对现有的设计进行review和讨论
> 3. 编码只联动绑定状态，底层房间与终端的关键，需要从AGENTER.mdx 这个提示词出发。不可以做编码硬关联。因为一个Avatar本身就要处理多个room和多个terminal，不同的terminal和room之间会有关联是正常的。甚至我可以说：`到 shell-181 聊统一吧`，这也是可以的。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Open a vision-driven OpenSpec change to discuss large-scale focused `attentionContext` behavior. | This round is investigation and architecture alignment, not implementation. |
| 1 | User | Find the recent proposal where killed terminals mute their bound `attentionContext`. | Must verify prior law before proposing new behavior. |
| 1 | User | Find the older proposal for a URI format that globally identifies terminal, room, and similar instances; inspect code completion. | Must distinguish existing global identity law from missing app binding law. |
| 1 | User | Consider shell-next binding `terminalInstance` to `roomInstance`: terminal killed -> terminal context muted as kernel behavior -> room archived as shell-next app behavior -> room context muted as kernel behavior. | Need map current atoms, identify missing contracts, and avoid cross-system coupling. |
| 2 | User | Adopt Option A. Discuss whether `msg:` should split into `msg:` + `room:` now that roomManagement is separated from messageSystem. | Specs must decide source namespace meaning before any new instance-ref law. |
| 2 | User | shell-next needs true `roomInstance` and `terminalInstance` memory instances, and their lifecycle + API logic should be hard-bound if the APIs exist or designed if missing. | Must review current in-memory instance/API availability instead of only SDK projections. |
| 2 | User | Code may only link binding state; the deeper terminal-room relationship must come from `AGENTER.mdx` prompt/Avatar reasoning, because one Avatar handles multiple rooms and terminals and associations can be user-directed. | App binding must not encode semantic conversation routing or task-specific room-terminal intent. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `openspec/changes/archive/2026-05-25-rework-terminal-live-registry-and-history-projection/specs/attention-context-state/spec.md` | Contains `Terminal death SHALL mute the bound attention context through durable lifecycle consequence`. | This confirms the remembered proposal exists and was archived this week. |
| `openspec/specs/attention-context-state/spec.md` | The terminal-death mute requirement is now in durable specs. | The law is not only a stale change artifact; it became long-term spec truth. |
| `openspec/changes/archive/2026-05-25-rework-terminal-live-registry-and-history-projection/design.md` | Rejects isolated helper calls and says terminal death should publish lifecycle facts, then the runtime/adapter commits the attention consequence. | Confirms the intended architecture is event/fact causality, not app-side focus flipping. |
| `packages/app-server/src/session-runtime.ts` | `handleKilledRuntimeTerminal(...)` enqueues a `terminal_killed` lifecycle attention commit for `ctx-terminal-<terminalId>`. | Code completion exists for the terminal killed source fact path. |
| `packages/app-server/src/session-runtime.ts` | `handleCommittedAttentionCommit(...)` detects lifecycle commits tagged `terminal_killed` and calls `applyAttentionFocusState(contextId, "muted")`. | Code completion exists for terminal killed -> terminal context muted. |
| `packages/app-server/src/session-runtime.ts` | `applyAttentionFocusState(...)` calls `syncCompanionRoomArchiveProjection(...)`. | Current generic companion law is context muted -> room archived, not necessarily room archived -> context muted. |
| `packages/app-server/src/session-runtime.ts` | `archiveMessageChannel(...)` archives the room and enqueues a lifecycle attention item, but does not set the room context focus state to `muted`. | This is a gap against the user's proposed room archive -> room context muted kernel behavior. |
| `openspec/changes/archive/2026-05-08-add-cli-shell-app/design.md` | Defines app runtime planes, including `appId + resourceKey` resource binding APIs for terminal and room resources. | This is the closest completed law to the remembered global instance identity proposal. |
| `openspec/specs/app-runtime/spec.md` | Durable spec says products provide `appId` and `resourceKey`, while owning systems remain authorities for terminal, room, AvatarRuntime, attention, and actor truth. | Current identity law is app-owned key plus owner-system metadata, not one universal URI string. |
| `openspec/changes/realign-cli-shell-with-core-system-boundaries/design.md` | App binding must expose current app key, terminal id, room id, AvatarRuntime identity, and attention hosting context id. | This describes the needed binding projection, but not yet a durable binding graph with lifecycle reactions. |
| `openspec/changes/realign-cli-shell-with-core-system-boundaries/tasks.md` | Some binding-related SDK/context tasks remain unchecked. | App binding work is partially complete; the current chain should not assume all planned binding surfaces landed. |
| `packages/client-sdk/src/app-runtime.ts` | `ensureTerminalBinding` and `ensureRoomBinding` match resources by binding metadata and return `bindingMetadata`; app resource keys are explicitly not TerminalSystem ids. | Code implements metadata-based binding lookup and creation. |
| `apps/shell-next/src/app/bootstrap.ts` | shell-next creates terminal and room with the same `appId=shell-next` and `resourceKey=<shellName>`, then returns a projection containing terminal id, room id, runtime id, avatar actor id, and hosting context id. | shell-next already has a runtime projection of the desired relationship during bootstrap. |
| `apps/shell-next/src/app/runtime.ts` | Terminal source `terminateTerminal` only calls `stopGlobalTerminal({ terminalId })`. | There is no visible shell-next lifecycle controller here that archives the bound room after terminal death. |
| `apps/shell-next/src/app/cleanup.ts` | Cleanup can find app resources by metadata and delete rooms/terminals, but it is a manual cleanup action. | Cleanup is not the automatic terminal killed -> room archived chain. |
| `packages/app-server/src/attention-src.ts` and `loopbus-plugin-runtime.ts` | Runtime source refs use protocol-native namespaces such as `msg:<chatId>/<messageId>`, `tty:<terminalId>[/eventId]`, and `task:<subjectId>`. | There is a typed `src` law for source reading, but it is not a global instance URI law for app binding. |
| `SPEC.md` | Long-term law says LoopBus/source adapter refs must keep protocol-native `src` law and not reopen metadata escape hatches. | Any new global instance reference must not smuggle semantics through arbitrary metadata. |
| `SPEC.md` | Room durability belongs to the `room-management` boundary; `message-system` is the messaging authority/runtime and may still contain local room-management code in the same package. | The `msg:` namespace currently mixes room-scope and message-row source identity even though room-management is now the durable room owner. |
| `packages/message-system/SPEC.md` | `room-management` owns room catalog, transcript truth, room revision, transcript revision, read/unread truth, lifecycle, membership, and pub/sub durability; current implementation may still live in `packages/message-system`. | Supports discussing a namespace split as architecture, even before package split. |
| `openspec/specs/attention-src-registry/spec.md` | `msg` currently formats both room-scope `msg:<chatId>` and row-scope `msg:<chatId>/<messageId>`, and groups row sources by room bucket. | Splitting `room:` from `msg:` would redefine the source registry boundary, not just rename strings. |
| `packages/message-system/src/message-control-plane.ts` | In-memory `MessageControlPlane` has channel listeners, focus listeners, create/list/get/archive/unarchive/delete channel APIs, and follow-up attention writes using `msg:<chatId>/<messageId>`. | Room lifecycle/API exists in a control-plane instance, but it is exposed as channel/room entries through message-system, not as a separate `RoomInstance` object. |
| `packages/terminal-system/src/terminal-control-plane.ts` and `managed-terminal.ts` | In-memory TerminalControlPlane exposes `getManagedTerminal`, lifecycle listeners, live/history/archive APIs, and `ManagedTerminal` exposes snapshot/lifecycle hooks. | Terminal lifecycle/API exists as real in-process control-plane/runtime instances inside app-server, while shell-next currently sees SDK projections over transport. |
| `packages/client-sdk/src/runtime-store.ts` | Client SDK exposes `archiveGlobalRoom`, `stopGlobalTerminal`, lists, snapshots, focus APIs, and runtime event subscriptions. | shell-next has API projections, not direct in-memory control-plane object references. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not ready; this round is research-plan only. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not started. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started. |
| Normal archive | Commit containing `openspec archive <change>` result | Not started. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `archive/2026-05-25-rework-terminal-live-registry-and-history-projection` | Terminal killed is a lifecycle fact that mutes the bound terminal attention context. | Reuse. The terminal half of the user's proposed chain is already law. |
| `openspec/specs/attention-context-state/spec.md` | Focus state is durable and terminal death mutes bound context. | Reuse; extend with room archive -> room context muted if confirmed. |
| `openspec/specs/app-runtime/spec.md` | App resources bind through `appId + resourceKey + resourceKind + ownerSystem`. | Reuse as current binding law; consider whether to upgrade it into a first-class instance-ref/URI law. |
| `archive/2026-05-08-add-cli-shell-app` | App binding APIs ensure terminal and room resources through owners; app metadata links stable app key to backend ids. | Reuse; shell-next should use the same app-extension runtime law. |
| `realign-cli-shell-with-core-system-boundaries` | App binding should expose terminal id, room id, AvatarRuntime identity, and attention context ids. | Extend; this is close to the needed shell-next binding projection but not enough for automatic lifecycle reactions. |
| `openspec/specs/workspace-resource-ownership/spec.md` | Rooms and terminals are global resources referenced by shells; WorkspaceSystem does not own them. | Reuse; app binding must not make workspace own room/terminal lifecycle. |
| `openspec/specs/runtime-system-boundary-law/spec.md` | Source facts preserve Avatar-authored context unless explicit context mutation is intended. | Reuse; lifecycle facts must not rewrite context summaries while changing focus state. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `成吨的focus attentionContext的问题` | Current focus/mute/background behavior is accumulating broad architectural debt. | Many contexts are staying active or focused when their owning resource lifecycle says they should no longer compete for attention. |
| `terminalInstance` | A concrete durable terminal instance owned by TerminalSystem. | Not a app key and not a UI pane. |
| `roomInstance` | A concrete durable message room/channel owned by MessageSystem. | Not a shell name and not an attention context. |
| `内核行为` | Cross-app platform consequence owned by runtime/kernel adapters and durable systems. | Should work for any app, not only shell-next. |
| `shell-next的应用行为` | App-specific policy that connects shell-next's terminal and room resources. | shell-next decides its bound room should archive when its bound terminal dies. |
| `uri的格式` | A stable global reference format for instances across systems. | May correspond to future instance refs; current code mainly has `msg:`/`tty:` source refs and metadata binding. |
| `真正的roomInstance、terminalInstance内存实例` | shell-next should bind to lifecycle-capable runtime/control-plane instances, not just ids in a stale list. | Today app-server has real instances; shell-next process mostly has SDK/store projections. |
| `编码只联动绑定状态` | App code may record/propagate structural binding and lifecycle state only. | It must not decide that room X is semantically "the terminal's discussion room" for all future Avatar reasoning. |
| `底层房间与终端的关键，需要从AGENTER.mdx这个提示词出发` | The AI's semantic choice of which room/terminal to use belongs to prompt-guided reasoning and explicit user instruction. | The platform provides refs and bindings; Avatar decides operational association in context. |
| `到 shell-181 聊统一吧` | A user can redirect conversation/work to a different shell room/terminal association at runtime. | Hard-coded room-terminal semantic coupling would be wrong. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | No spike needed yet. Current evidence comes from specs and production code. | n/a |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should the app binding be a durable first-class graph, or is reconstructing it from owner metadata acceptable for now? | Automatic lifecycle reactions need a reliable terminal -> room relation even after restart and possibly when shell-next UI is not running. | Recommend first-class durable binding graph or typed binding index, not ad hoc metadata scans. |
| Should terminal killed -> room archived run even when the shell-next process is already closed? | If yes, the controller cannot live only inside the local shell-next TUI process. | Recommend daemon-side app lifecycle controller or extension-runtime host for app bindings. |
| Do we want a new canonical instance URI/ref format now? | User remembers a URI proposal, but current durable law landed as app metadata and source refs. | Recommend defining a typed `InstanceRef`/URI law only if it replaces metadata escape hatches and becomes reusable across systems. |
| Should manual room archive also mute the room attention context? | User's proposed chain says room archived -> room context muted is kernel behavior, but current code does not do that. | Recommend yes for non-protected room-backed contexts, with explicit protection rules for default/built-in rooms. |
| Should the source namespace split be `room:` for room lifecycle/scope and `msg:` for transcript rows? | This changes the meaning of attention source identity after room-management separation. | Architecturally yes for new law, because `room:` names room lifecycle/state and `msg:` names message-row facts. |
| Should shell-next direct in-memory instance access mean direct imports or a daemon-side app controller? | A local app process cannot safely import app-server's singleton instances without collapsing process boundaries. | Recommend daemon-side app controller gets real instances; shell-next process consumes typed lifecycle API/projections. |
| What exactly may be hard-bound in code? | User forbids semantic hard association between terminal and room. | Only app binding lifecycle state and cleanup/archive reaction may be hard-bound; task routing remains prompt/Avatar-driven. |

## Intent

### Surface Intent

Use a vision-driven OpenSpec change to discuss how shell-next should bind a terminal instance to a room instance and how lifecycle changes should mute/archive the corresponding attention contexts without leaving focused attention debt behind.

### Underlying Drive

The pressure is not one more shell-next cleanup hook. The system needs a clean lifecycle law:

1. resource-owning systems emit durable lifecycle facts;
2. kernel/runtime adapters map those facts to attention focus consequences;
3. app-specific bindings express cross-resource policy without making TerminalSystem import MessageSystem or AttentionSystem;
4. UI/app processes are projections, not the only place where durable lifecycle effects can happen.
5. code links structural binding state, while semantic room-terminal association remains a prompt/Avatar decision.

### Final Visible Effect

When a shell-next terminal is killed, the operator should stop seeing that shell as active work. The terminal leaves live terminal surfaces and its terminal attention context becomes `muted`. The shell-next room bound to that terminal moves out of the active room list into archive. The room's attention context also becomes `muted`, so unresolved historical room facts no longer wake the LoopBus by default. Unrelated terminals, rooms, and contexts remain unchanged.

This must not mean "the Avatar can only discuss that terminal in that room". If the user says "go discuss it in shell-181", the Avatar should be able to use the exposed room/terminal refs and choose that route through prompt-guided reasoning. The platform only keeps lifecycle and binding facts coherent.

## Platform Diagnosis

- Current platform laws:
  - TerminalSystem owns terminal durable lifecycle and live/history/archive projections.
  - MessageSystem owns room durable lifecycle and archive/delete projections.
  - AttentionContext owns durable focus state: `focused | background | muted`.
  - Runtime/kernel adapters commit source facts and focus consequences; app code should not silently flip unrelated kernel state.
  - App extension runtime currently binds resources through `appId + resourceKey + resourceKind + ownerSystem` metadata.
  - Runtime source refs already use protocol-native `msg:`, `tty:`, and `task:` namespaces for source reading.
  - Room durability is now the `room-management` boundary, while current code still implements local room-management inside `packages/message-system`.
- Does this fit as a regular atom:
  - Partly. Terminal killed -> terminal context muted fits existing kernel law and code.
  - shell-next terminal -> room archive fits as a app atom only if the terminal-room relation is explicit and durable enough.
  - room archive -> room context muted is a missing kernel law if we accept the user's proposed chain.
  - `msg:` split into `room:` + `msg:` is a namespace law upgrade, not a shell-next-only change.
- Does this require law upgrade:
  - Yes, if automatic app lifecycle reaction must survive shell-next process exit/restart.
  - Yes, if the remembered URI law should become a canonical cross-system instance identity instead of metadata conventions.
  - Yes, if room-management separation should be reflected in attention source refs.
- Breaking update stance:
  - Prefer law upgrade over adding another shell-next-only hook. A direct metadata watcher can be a transitional implementation only after the durable boundary is named.
- User confirmations still required:
  - Whether to create a new first-class instance URI/ref law now.
  - Whether automatic shell-next room archiving is daemon-side durable behavior or only live shell-next application behavior.
  - Whether `room:` should replace room-scope `msg:<chatId>` while preserving `msg:<chatId>/<messageId>` as message-row identity.

## Reverse-Inferred Design

### Interaction / Visual Story

The ideal observed flow is:

```text
operator kills shell-next terminal
        |
        v
TerminalSystem: terminalInstance.processPhase = killed
        |
        v
Runtime kernel: ctx-terminal-<terminalId>.focusState = muted
        |
        v
shell-next app policy: bound roomInstance is archived
        |
        v
Runtime/message kernel: ctx-<roomId>.focusState = muted
        |
        v
LoopBus no longer wakes from that terminal/room's ordinary unresolved debt
```

### Interface Shape

The app-facing contract should be phrased in app terms:

- shell-next has one active binding for `appId=shell-next`, `resourceKey=<shellName>`.
- That binding names:
  - `terminalInstance`: `{ ownerSystem: "terminal-system", id: <terminalId> }`
  - `roomInstance`: `{ ownerSystem: "message-system", id: <chatId> }`
  - `runtimeInstance`: current AvatarRuntime/session identity
  - `attentionContexts`: terminal context id, room context id, hosting context id
- The app can express a lifecycle reaction:
  - when `terminalInstance` reaches `killed`, archive `roomInstance`.
- The app cannot express semantic routing:
  - "terminal A belongs to room B for all task conversation" is not a platform fact.
  - "shell-next binding X contains terminal A and room B" is a platform fact.
  - "this task should be discussed in shell-181" is an Avatar/user-directed operational choice.
- Kernel/runtime adapters express generic focus consequences:
  - terminal killed mutes terminal context;
  - room archived mutes room context.

### Data Shape

Do not confuse these facts:

- `terminalId`: durable TerminalSystem instance id.
- `chatId`: durable MessageSystem room id.
- `contextId`: durable AttentionSystem context id.
- `resourceKey`: app-local stable key such as `shell-20`; not a terminal id and not a room id.
- `sourceRef.src`: source-read address such as `tty:<terminalId>` or `msg:<chatId>/<messageId>`; useful for attention facts, but not enough by itself to encode a app terminal-room binding.
- App binding metadata: current reconstruction surface; useful but too implicit for automatic lifecycle reaction if no durable index/controller owns it.

Namespace split candidate:

- `room:<chatId>` names room instance lifecycle, room metadata, membership, read state, archive/delete, and room-level revision facts owned by room-management.
- `msg:<chatId>/<messageId>` names a transcript row or row-scoped message fact.
- `msg:<chatId>` should disappear in the new law if `room:<chatId>` exists, because a room-scope address is not a message-row address.

Meaning:

- `room:` is to room-management what `tty:` is to TerminalSystem: an instance/lifecycle source.
- `msg:` remains the transcript-row family.
- Notification grouping can bucket `msg:<chatId>/<messageId>` under `room:<chatId>` instead of using `msg:<chatId>` as both row bucket and room source.

Benefits:

- Makes room-management separation visible in the source namespace law.
- Stops overloading `msg:` with both room lifecycle and message-row facts.
- Gives app binding a natural instance ref for room lifecycle: `room:<chatId>`.
- Makes future RPC/pub-sub room-management exposure easier because it can own `room:` independently from message-system contact runtime.

Costs:

- All source registry specs and parsers must change.
- Message follow-up tasks currently commit `msg:<chatId>/<messageId>` and may still work, but any room-scope `msg:<chatId>` code must migrate to `room:<chatId>`.
- Notification projection and source bucket logic need a clear cross-namespace bucket rule: message rows group to a room bucket.
- Existing docs and tests that call `msg:<chatId>` "room-scope message source" become wrong by design.

### Architecture Shape

Recommended platform split:

1. TerminalSystem remains pure. It only owns terminal lifecycle and emits/publishes terminal facts.
2. MessageSystem remains pure. It only owns room lifecycle and archive/delete facts.
3. AttentionSystem remains pure. It stores context focus state and commits.
4. Runtime/kernel adapters map owner-system lifecycle facts to attention focus state.
5. App extension runtime owns app bindings as a generic platform surface.
6. shell-next owns the app policy: terminal killed archives bound room.
7. Prompt/Avatar runtime owns semantic routing between rooms and terminals for actual work.

Forbidden couplings:

- TerminalSystem must not import MessageSystem, AttentionSystem, or shell-next.
- MessageSystem must not know shell-next or terminal ids.
- AttentionSystem must not know app metadata or resourceKey semantics.
- shell-next should not directly mutate AttentionSystem focus as a substitute for owner-system lifecycle facts.
- shell-next app code must not hard-code semantic conversation routing between one terminal and one room.
- AGENTER.mdx/prompt guidance may teach the Avatar how to use binding facts, but must preserve the freedom to choose another room/terminal when the user directs it.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Instance URI/ref format | A new URI/ref law may affect source refs, app metadata, specs, tests, and future products. | Keep current metadata/source-ref facts in research; do not implement a new URI yet. |
| Lifecycle controller location | If the controller must run after shell-next exits, it belongs in daemon/app-extension runtime, not local TUI. | Assume durable daemon-side controller is the architecturally correct target. |
| Room archive -> muted law | Current code does not do it directly. This is a kernel behavior change. | Treat as desired law for non-protected room-backed contexts, pending confirmation. |
| `msg:` split | This affects source registry, notification grouping, and message follow-up refs. | Prefer `room:<chatId>` for room lifecycle/scope and `msg:<chatId>/<messageId>` for transcript rows. |
| Direct instance access | Direct shell-next imports would collapse extension/process boundaries. | Put real instance hard-binding in daemon-side app lifecycle controller; shell-next receives typed projections/API. |

## Options

### Option A: Law Upgrade, Recommended

Create a first-class app binding/lifecycle reaction law:

- Define typed instance refs, either as structured `{ system, id }` objects or canonical URI strings.
- Optionally align source refs with the instance law: `tty:<terminalId>`, `room:<chatId>`, `msg:<chatId>/<messageId>`.
- Persist or index app bindings so shell-next's terminal -> room relation is inspectable after restart.
- Add a generic daemon-side app lifecycle reaction host that can observe real terminal/room control-plane lifecycle facts and invoke app policies.
- Add room archive -> room context muted in the runtime/message adapter boundary.
- Keep semantic terminal-room work routing out of app code and in AGENTER.mdx/Avatar reasoning.

Why this is the durable path: it keeps all core systems orthogonal, makes shell-next an ordinary app policy, and lets future products bind terminal/room/task/browser resources without copying shell-next-specific glue.

### Option B: Metadata Watcher, Transitional Only

Have shell-next subscribe to runtime store changes, find terminals and rooms with matching `appId=shell-next` and `resourceKey`, and call room archive when a terminal becomes killed.

Why this is weaker: it only works while the shell-next process is alive, reconstructs causal binding from metadata each time, and risks becoming another app-specific watcher pattern. It can be acceptable as a narrow stepping stone only if the durable binding law is still written first.

### Option C: Direct Shell-Next Imports Of Core Instances, Rejected

Let the shell-next process import or receive raw `MessageControlPlane` / `TerminalControlPlane` objects and bind them itself.

Rejected because shell-next is an extension/app process. Direct imports would make process-local implementation shape the platform boundary, and it would not naturally survive daemon restart or remote app hosting. The correct place for true memory instances is inside the daemon/app-server app lifecycle controller; shell-next should consume typed lifecycle APIs and projections.

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Is there a specific remembered URI proposal name/date that should override the metadata-binding evidence found here? | Search found source refs and app metadata binding, but no exact `agenter://`, `terminal://`, or `room://` law. | Treat URI as a missing or renamed proposal unless more evidence appears. |
| Should archived shell-next rooms remain send-capable but inactive, matching existing room archive semantics? | Archive is reversible and not delete; shell-next UX must not imply data loss. | Yes, archive means visibility/focus lifecycle, not destructive dissolve. |
| Should built-in/default rooms be protected from archive -> muted? | Current code protects default/built-in rooms from companion archive projection. | Preserve protection until a broader room law is explicitly upgraded. |
| Should terminal archive, not only terminal killed, have any room effect? | User named killed; terminal archive is history visibility over already-killed evidence. | No extra room effect beyond killed-triggered app policy. |
| Is `room:<chatId>` the canonical instance ref, or should a new URI such as `agenter://room/<chatId>` wrap it? | Source refs and app instance refs may be separate layers. | Prefer protocol-native short refs for LoopBus/source identity and structured `InstanceRef` for app binding; avoid overloading one string with every role. |
| How should AGENTER.mdx present binding facts? | The prompt must enable Avatar reasoning without making app code decide conversation routing. | Teach that shell-next binding exposes available room/terminal refs, but user instruction and current task context decide which room/terminal to use. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| TerminalSystem directly archives MessageSystem rooms when a terminal dies. | Violates orthogonal atoms; TerminalSystem would own app topology. |
| shell-next directly calls AttentionSystem to mute terminal and room contexts. | Hides causality and duplicates kernel behavior that should follow lifecycle facts. |
| Use `resourceKey` as the terminal id or room id. | Existing app-extension runtime explicitly rejects that because app keys collide with killed/history recovery and backend allocation laws. |
| Treat `msg:` / `tty:` source refs as the complete app binding format. | They address source reads, not multi-resource app ownership or lifecycle reactions. |
| Encode "this terminal's discussion must happen in this room" in app binding. | Violates the user's constraint: one Avatar handles many rooms and terminals, and user-directed routing may choose another shell room. |
| Give shell-next direct in-process ownership of app-server control-plane instances. | Collapses extension boundary and makes daemon-side lifecycle durability depend on a local UI process. |

## Exit Conditions

- Default max review iterations: 3
- Issue recurrence threshold: if the same missing-boundary question repeats twice, move it into specs/tasks instead of continuing prose discussion.
- Custom exit condition from intent: before implementation, the change must state whether it is creating a new instance URI/ref law or extending existing app metadata binding, and must state where the shell-next lifecycle reaction runs.
- Additional exit condition: before implementation, specs must state whether room-scope source identity is `room:<chatId>` or remains `msg:<chatId>`, and must state that code binds lifecycle state only while semantic room-terminal routing remains Avatar/prompt-owned.
