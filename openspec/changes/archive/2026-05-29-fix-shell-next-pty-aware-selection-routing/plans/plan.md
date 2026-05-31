# Intent Document

## Current Round

- Round: 1
- Status: implementation-ready after repo survey
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

> 现在专注于解决残留的问题：关于 Shell 的 Selection 问题。
>
> 使用全新的 openspec vision-driven 进行开发
>
> 1. 关于三击选择行，这个目前是已经实现的
> 2. 双击选择单词，这个明显有问题，原本的实现是基于 Intl.Segmenter 来实现分词的，这个算法是不是没迁移过来？
> 3. 现在最严重的问题是鼠标拖动选择. 你上面的计划提到了算法，算法确实不难，但你得做在 termless-backend-utils 层，方便其它backend复用
> 4. 关于鼠标的问题，还有一个重点，就是鼠标的行为并不是“全局的”，而是基于PTY的信号解析
>
> Implement the plan.

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | `使用全新的 openspec vision-driven 进行开发` | Create this change with `vision-driven`; keep `plans/plan.md` as SSOT. |
| 2 | User | `关于三击选择行，这个目前是已经实现的` | Preserve triple-click line selection. Do not spend effort replacing it. |
| 3 | User | `双击选择单词...原本的实现是基于 Intl.Segmenter 来实现分词的` | Keep word segmentation in the backend interaction layer; investigate projection/routing before replacing algorithm. |
| 4 | User | `鼠标拖动选择...得做在 termless-backend-utils 层，方便其它backend复用` | Drag selection state machine belongs in `termless-backend-utils`, not Shell-Next app code. |
| 5 | User | `鼠标的行为并不是“全局的”，而是基于PTY的信号解析` | Pointer routing must respect per-terminal PTY mouse mode. TUI mouse requests must receive encoded mouse input instead of host selection. |
| 6 | User | `Implement the plan.` | Proceed to artifact creation, BDD tests, implementation, verification, and cleanup. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/termless-core/src/terminal-interaction.ts` | `findWordInTerminalLine` uses `Intl.Segmenter`; backend adapter owns word/line selection. | The word algorithm was not lost. The remaining bug is likely coordinate projection/routing. |
| `packages/termless-backend-utils/src/terminal-host-input.ts` | Pointer drag, double click, key selection, and input transactions already live in backend-utils. | This is the correct lower layer to extend with PTY-aware routing. |
| `apps/shell-next/src/opencompose/terminal-frame/frame-renderable.ts` | `sourceStartRow` exists and maps visible rows to backend rows when `selectionSources` are present. | Shell-Next currently has the right projection primitive but terminal frame is not feeding it. |
| `apps/shell-next/src/opencompose/terminal-frame/terminal-frame-renderable.ts` | Terminal frame updates pass overlays but not `selectionSources`. | Scrolled double-click/drag can be sent as viewport-local rows instead of absolute backend rows. |
| `apps/shell-next/src/terminal-projection/framebuffer-terminal-pane.ts` | Primary copy fires for any handled pointer-up result. | PTY mouse passthrough must be distinguishable from selection completion. |
| `packages/terminal-system/SPEC.md` | Terminal interaction is backend/offscreen renderer capability; host projection cannot own selected text truth. | The new state must stay backend-owned and travel through frame/transport truth. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending; `bun.lock` is pre-existing dirty state and must not be staged. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending. |
| Normal archive | Commit containing `openspec archive <change>` result | Pending user acceptance. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not expected. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `rework-shell-next-terminal-interaction-ownership` | Backend owns selection/copy/semantic selection; Shell-Next is projection and host capability outlet. | Extend. |
| `fix-shell-next-background-run-lifecycle-and-input-boundary` | Shell-Next UI lifecycle is separate from terminal/process lifecycle. | Reuse; this change must not reintroduce terminal cleanup side effects. |
| `extract-termless-backend-utils` | Shared host input behavior belongs in reusable backend utility package. | Extend with mouse routing. |
| `packages/terminal-system/SPEC.md` | Terminal-native input bytes are transport truth; browser/host events are local facts. | Extend by carrying PTY mouse mode as terminal frame state. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `残留的问题` | This has failed multiple times and must be closed at architecture level. | Fix the root path, not another local symptom. |
| `不是全局的` | Mouse ownership is per terminal/pane, not a Shell-Next global mode. | Route by target pane's PTY mode. |
| `基于PTY的信号解析` | Child output escape sequences decide whether mouse belongs to the TUI. | Track DECSET/DECRST mouse modes per backend. |
| `termless-backend-utils 层` | Reusable host input controller layer. | Shell-Next must consume the generic controller. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Existing tests and xterm mode probes are sufficient. | Not needed. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should this support non-SGR legacy coordinate encoding? | Some TUI programs request mouse tracking without `1006`. | Yes. Encode default and SGR modes so routing is faithful. |
| Should Shift bypass PTY mouse routing if the host still delivers the event? | Outer terminals often consume Shift-mouse before apps see it. | Yes. If delivered, Shift forces host selection path. |

## Intent

### Surface Intent

Fix Shell-Next selection so double-click word selection, drag selection, scrolled viewport projection, and TUI mouse behavior all behave like a terminal multiplexer instead of a global app-level mouse grab.

### Underlying Drive

The app needs an embedded mux-like terminal boundary. Shell-Next can render and compose panes, but terminal interaction laws must live in reusable terminal layers. The user is pushing away from app glue toward platform rules.

### Final Visible Effect

- In plain shell output, drag selects text and release mirrors the selected text to the primary selection through the existing OSC52 path.
- Double-click selects words using `Intl.Segmenter`, including when the viewport is scrolled.
- Triple-click still selects the full line.
- Inside Vim/htop/lazygit or any TUI that has requested xterm mouse tracking, click/drag/wheel are encoded back to the PTY and do not mutate Shell-Next selection or primary copy.
- Shift-mouse, when delivered, remains the operator escape hatch for host text selection.

## Platform Diagnosis

- Current platform laws: backend owns terminal interaction truth; transport carries frame facts; Shell-Next owns projection and host clipboard outlet.
- Does this fit as a regular atom: mostly yes. The missing atom is `TerminalMouseTrackingState` plus a reusable pointer router.
- Does this require law upgrade: yes, but local and orthogonal. Mouse tracking becomes a first-class terminal frame fact.
- Breaking update stance: acceptable inside internal terminal interaction contracts; no user data migration.
- User confirmations still required: none for implementation. Archive still requires acceptance.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator points at one pane. The host first asks that pane's backend state who owns mouse. If the child TUI requested mouse, the event becomes terminal input bytes. If not, the same event becomes backend-owned selection. The operator should not need to know which package made the decision.

### Interface Shape

- `TerminalMouseTrackingState`: `{ protocol, encoding }`
- host pointer input: backend absolute `point`, viewport-local `viewportPoint`, and modifiers.
- pointer dispatch result: explicit `effect` so app shells can tell selection completion from PTY passthrough.

### Data Shape

- Durable fact: PTY mouse tracking protocol/encoding derived from child output.
- Projection: viewport coordinates used only to encode bytes for the target pane.
- Selection truth: backend absolute rows/cols only.
- Host effect: primary copy only after `selection-finalized`.

### Architecture Shape

- `termless-core`: expose mouse tracking state on interaction/frame truth.
- `terminal-system` / `terminal-transport-protocol`: carry mouse state through full and patch frame paths.
- `termless-backend-utils`: implement PTY-aware pointer routing and xterm mouse encoding.
- Shell-Next terminal renderables: calculate absolute and viewport-local points, pass modifiers, and map scrolled viewport rows through `selectionSources`.
- Shell-Next app/pane: copy primary only for finalized backend selection.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Archive | Archiving syncs long-term specs and closes the change. | Do not archive until accepted. |

## Intent-Driven Plan

- [x] 1. Research existing selection, transport, and renderable projection code.
- [ ] 2. Write vision-driven specs and BDD task list.
- [ ] 3. Add failing BDD tests for PTY-aware routing and scrolled projection.
- [ ] 4. Implement `TerminalMouseTrackingState` and transport propagation.
- [ ] 5. Implement reusable backend-utils pointer routing.
- [ ] 6. Wire Shell-Next projection and primary-copy effect boundaries.
- [ ] 7. Run focused verification, self-review, and cleanup.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should global host terminal mouse enablement be handled here? | The outer terminal must deliver mouse events to Shell-Next. | Not part of this fix; current OpenTUI host already receives mouse events in tests/runtime. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Parse mouse sequences in Shell-Next | Violates the user's per-PTY/backend ownership requirement. |
| Always let Shell-Next drag-select | Breaks Vim/htop/lazygit and other mouse-aware TUIs. |
| Replace `Intl.Segmenter` word selection | Existing backend algorithm is already correct; the bug is projection/routing. |
| Copy primary on every handled pointer-up | PTY passthrough is handled but not a selection completion. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2
- Custom exit condition from intent: focused tests prove plain shell selection and TUI mouse routing diverge correctly by backend state.
