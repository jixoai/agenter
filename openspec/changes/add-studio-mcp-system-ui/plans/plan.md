# Intent Document

## Current Round

- Round: 1
- Status: Convert the existing `add-studio-mcp-system-ui` change to vision-driven intent before app-code work starts.
- Previous plan backup: none; this is the first `plans/plan.md` for this change.

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

> 我们需要开发mcp相关的页面，就是在apps/studio 中。请你参考 skills/notes 的页面设计，然后开始开发和设计。
> 记住几个原则：
> 1. 页面是给聪明的人类看的，不是给婴儿看的。所以不要在页面上堆砌“文本介绍”，但你可以适当用helphint去收纳这类信息
> 2. 不要在页面上嵌套过多的卡片层级，减少 border的出现
>
> 以上两原则都是能避免你出现太多的“信息噪声”，这都是会导致聪明的人类消耗精力、分心去接收信息，结果发现这些信息他自己已经能脑补出来，会觉得自己浪费时间的挫败感。
> 更进一步，整个应用要考虑长时间使用这个软件的人，它不想重复看到一些没用的信息。
>
> ---
>
> 这些原则如果没有在最佳实践中，请补充进去。然后开始用openspec vision 推进这项任务

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Develop MCP-related pages in `apps/studio`; reference Skills/Notes page design; do not overload pages with text introductions; use HelpHint for explanatory material; avoid nested cards and excessive borders; add these principles to best practices if absent; proceed with OpenSpec vision. | MCP page must inherit Studio workbench law, optimize for expert long-session operators, and begin from an intent/interaction artifact before implementation. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `openspec/changes/add-studio-mcp-system-ui/proposal.md` | Existing proposal already targets `/mcp`, client runtime-store facade, and a simpler-than-Skills workbench. | Reuse the existing change id and intent instead of starting a competing change. |
| `openspec/changes/add-studio-mcp-system-ui/design.md` | Existing design frames MCP as runtime-owned facts projected through Studio, with global/project/lifecycle/snapshot/action surfaces. | Keep the platform boundary: Studio projects `mcpSystem`; it does not own MCP truth. |
| `openspec/changes/add-studio-mcp-system-ui/tasks.md` | Existing tasks cover runtime contracts, workbench shell, interactions, and verification, but predate the low-noise operator rule. | Tasks need refinement before implementation. |
| `openspec/changes/add-studio-mcp-system-ui/specs/*` | Specs already require primary `/mcp` route, runtime scoping, exact-project projection, safe actions, structured snapshots, and BDD coverage. | Specs are directionally correct; add visual/noise constraints rather than replacing the capability model. |
| `openspec/specs/mcp-system/spec.md` | `mcpSystem` owns global configs, exact-project enablement, lifecycle, snapshots, SQL query, and invocation facts. | UI must preserve global/project separation and not invent shortcut semantics. |
| `apps/studio/src/lib/features/notes/*` | Notes uses `WorkbenchWindow`, `WorkbenchPageToolbar`, `WorkbenchPageContent`, tabs, split-detail, and HelpHint in detail surfaces. | MCP should reuse the workbench shell and split-detail pattern, not clone all Notes copy density. |
| `apps/studio/src/lib/features/skills/*` | Skills uses a tabbed workbench and catalog/detail browser pattern. | MCP can borrow catalog/list-detail mechanics while staying simpler than Skills. |
| `DESIGN.md` | Existing design laws already reject nested page cards and excessive borders, but did not explicitly name expert/operator noise budget. | Updated this round with low-noise operator surface and boundary budget law. |
| `.agents/skills/develop-agenter/references/studio-ui.md` | Studio UI best practices already include shell/layout/testing rules, but not the user's current low-noise guidance. | Updated this round so future Studio work inherits the principle. |
| `openspec/changes/add-studio-mcp-system-ui/demos/mcp-route-desktop-smoke.png` | Desktop `/mcp` smoke rendered the first workbench slice without blank page or obvious overlap. | Keep as route-level visual evidence until formal route smoke is added. |
| `openspec/changes/add-studio-mcp-system-ui/demos/mcp-route-iphone14-smoke.png` | iPhone 14 `/mcp` smoke rendered the compact route after moving filters out of fixed toolbar. | Confirms the first compact layout does not repeat the toolbar overflow bug found in this round. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending; working tree has this plan and best-practice updates in progress. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending; no MCP app-code task is marked done yet. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending. |
| Normal archive | Commit containing `openspec archive <change>` result | Pending. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed in this round. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/changes/add-studio-mcp-system-ui` | Active MCP Studio UI change with specs/tasks already present. | Extend and convert to vision-driven by adding this plan as SSOT. |
| `openspec/specs/mcp-system/spec.md` | MCP global configs, project enablement, lifecycle, snapshots, query, and calls are runtime facts. | Reuse; UI is a projection atom. |
| `openspec/specs/client-runtime-store/spec.md` | Browser products should consume runtime-store contracts rather than server internals. | Extend with typed MCP facade. |
| `openspec/specs/studio-app/spec.md` | Studio app shell and workbench destinations define visible app structure. | Extend with `/mcp` route and navigation. |
| `DESIGN.md` | Page chrome, toolbar, page-content, right-drawer, density, and border laws. | Extend with explicit low-noise operator-surface law. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `mcp相关的页面` | Studio operator surface for managing and inspecting runtime MCP facts. | `/mcp` workbench in `apps/studio`. |
| `参考 skills/notes 的页面设计` | Inherit workbench shell, tab/drawer/list-detail density, and route patterns. | Reuse Studio page physics, not literal copy. |
| `给聪明的人类看的，不是给婴儿看的` | Expert operator interface; assume users can infer obvious concepts. | Avoid tutorial prose in primary surfaces. |
| `不要在页面上堆砌“文本介绍”` | Explanations should not occupy persistent working space. | Put help in contextual hints or empty/error states. |
| `helphint` | Existing `HelpHint` component/pattern for collapsed explanation. | Use for low-frequency conceptual explanation. |
| `不要在页面上嵌套过多的卡片层级，减少 border的出现` | Avoid visual boundary noise and card nesting. | Structure with shell, split-detail, dividers, spacing, and state. |
| `信息噪声` | UI elements that cost attention without changing decisions. | Remove repeated copy, duplicated facts, decorative framing. |
| `长时间使用这个软件的人` | Operator who lives in Studio for repeated work sessions. | Optimize for scan, action, and trust over onboarding copy. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| `openspec/changes/add-studio-mcp-system-ui/demos/mcp-workbench-low-noise.html` | Can the MCP page shape show global/project/lifecycle/snapshot facts without text-heavy onboarding or nested cards? | Keep as a change-local confirmation artifact until real Studio screenshots replace it. |
| `openspec/changes/add-studio-mcp-system-ui/demos/mcp-route-desktop-smoke.png` | Does the first real Studio `/mcp` route render on desktop with the intended workbench shape? | Keep until Storybook/route smoke evidence supersedes it. |
| `openspec/changes/add-studio-mcp-system-ui/demos/mcp-route-iphone14-smoke.png` | Does the first real Studio `/mcp` route remain usable on the iPhone 14 compact baseline? | Keep until Storybook/route smoke evidence supersedes it. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should the first implementation wire real daemon data immediately, or land a mocked Storybook/workbench shell first? | Runtime-store contracts may need app-server/daemon work; UI shape can be validated faster with fixture states. | Build contracts and mocked states together, then wire real runtime once facade shape is type-safe. |
| Should `/mcp` expose SQL query in the first visible page, or keep SQL as an advanced drawer/dialog action? | SQL is powerful but visually noisy if promoted to primary surface. | Keep SQL out of the default surface; use it as an advanced action/HelpHint-backed tool after list-detail projection works. |

## Intent

### Surface Intent

Build MCP pages inside Studio, using Skills/Notes workbench patterns, while keeping the interface low-noise for expert humans who repeatedly operate the system.

### Underlying Drive

The runtime already has `mcpSystem` as a platform atom. The missing atom is a Studio projection surface that lets an operator see and act on the system without falling back to CLI memory. The product pressure is not education; it is operational trust: installed globals, exact project enablement, lifecycle, snapshots, blocked removals, and call outcomes must be visible as facts with minimal framing noise.

### Final Visible Effect

An operator opens `MCP` in Studio and sees a dense workbench:

- one runtime authority selected or an explicit no-runtime state;
- a toolbar with runtime, exact project path, search/refresh, and add action;
- a scan-friendly MCP list showing name, transport, project enablement, lifecycle, snapshot count, and error marker;
- a right detail surface for global config, exact-project actions, project-local snapshots, latest errors, and optional test call;
- HelpHint for the low-frequency rules that would otherwise become repetitive body copy.

The page should feel closer to Notes/Skills as an app workbench than to a docs page, settings page, or tutorial.

## Platform Diagnosis

- Current platform laws: `mcpSystem` owns MCP truth; Studio is a projection surface; client runtime-store owns browser-facing contracts; Studio pages inherit shared workbench shell, toolbar, split-detail, scroll, and low-noise design laws.
- Does this fit as a regular atom: yes. The MCP page is a new Studio atom that attaches through runtime-store contracts and app-shell navigation.
- Does this require law upgrade: small UI law upgrade only. The user's low-noise operator guidance is now durable in `DESIGN.md` and Studio UI best practices.
- Breaking update stance: no runtime breaking change is required. A breaking app-code refactor is acceptable if existing Studio shell primitives cannot support the MCP workbench cleanly, but the default path is additive.
- User confirmations still required: whether SQL is first-class in the main page and whether first implementation should prioritize real daemon wiring over fixture-driven Storybook UI.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator does not read an explanation of MCP. They select a runtime, optionally type an exact project path, and scan rows. Row state tells the story:

- global exists but project is default-disabled;
- enabled but stopped;
- running with discovered tools/resources/prompts;
- failed with latest error;
- removal blocked by running project paths.

Selecting a row opens detail. Detail is continuous inspection, not a card stack. It uses compact sections, light dividers, and structured value viewers. Destructive or state-changing actions are explicit and command-like. HelpHint carries global/project law, auto-enable caveats, and stale snapshot explanation.

### Interface Shape

- Route: `/mcp`.
- Shell: `WorkbenchWindow` with one stable `MCP` tab at first; dedicated tabs can be added later only if a concrete sub-surface needs persistence.
- Toolbar: identity icon/title, runtime selector, exact project path input, search, refresh, add global.
- Main surface: list-detail layout using `WorkbenchPageContent` split-detail.
- Detail surface: global config summary, project enablement/lifecycle controls, snapshot sections, latest action facts, optional test-call dialog.
- Advanced surfaces: add/edit/remove dialogs, blocked-remove confirmation, optional SQL/query dialog.

### Data Shape

- Runtime authority: selected AvatarRuntime id and display label.
- Global config projection: name, title/description, transport kind, created/updated timestamps, config validity.
- Exact-project projection: projectPath, enabled/default-disabled state, lifecycle, snapshot presence, snapshot counts, latest error, latest action facts.
- Snapshot projection: project-local server info, tools, resources, prompts, schemas, snapshot time.
- Mutation outcomes: structured success, blocked projects, validation errors, lifecycle errors, call result/error.

Never collapse these:

- global existence vs project enablement;
- project snapshot vs global capability;
- stopped snapshot vs live running truth;
- blocked remove vs successful remove;
- explanatory HelpHint vs primary state.

### Architecture Shape

- Platform law update: low-noise operator surface guidance in `DESIGN.md` and Studio UI skill reference.
- Runtime atom: existing `mcpSystem` remains the only owner of durable MCP facts.
- Browser contract atom: `@agenter/client-sdk` and runtime-store add typed MCP input/view surfaces.
- Studio feature atom: `apps/studio/src/lib/features/mcp/*` owns UI state, fixtures, route components, dialogs, and stories.
- Forbidden coupling: Studio must not import `packages/app-server/src/mcp-system/*`, hand-build shell commands, or create a separate MCP database.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| SQL prominence | A first-class SQL pane may violate low-noise operator intent for the default page. | Keep SQL advanced, not primary. |
| Real daemon vs fixture-first | Real wiring may slow visual convergence; fixture-only may delay integration risk. | Build typed contract and fixture states first, then wire real runtime. |

## Intent-Driven Plan

- [x] 1. Research existing MCP OpenSpec, runtime law, Studio design law, and Notes/Skills workbench patterns.
- [x] 2. Add low-noise operator principles to durable Studio best practices.
- [x] 3. Create a change-local low-noise MCP workbench demo/prototype.
- [ ] 4. Update specs/tasks so low-noise design and HelpHint/cardless structure are testable requirements.
- [ ] 5. Run `bun run openspec:vision -- validate add-studio-mcp-system-ui`.
- [ ] 6. Run `bun run openspec:vision -- commit-check add-studio-mcp-system-ui --phase research-plan` before app-code work starts.
- [ ] 7. Implement runtime-store MCP facade and app-server/browser bridge with BDD tests.
- [ ] 8. Implement `/mcp` route, workbench shell, list-detail, dialogs, fixture stories, and route smoke coverage.
- [ ] 9. Self-review against this intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should MCP have one stable workbench tab or open per-runtime/project tabs like Notes avatars? | Persistent tabs add power but also visual weight. | Start with one stable `MCP` tab and keep runtime/project selection inside toolbar. |
| Should add/edit expose every transport field inline? | Full forms can become noisy and are low-frequency. | Use focused dialogs with compact sections and HelpHint for field law. |
| Should tool test-call be part of the first task batch? | It is operationally useful but can expand scope. | Include fixture and contract shape, but keep it optional behind detail action. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Make MCP a Settings subpage | It hides lifecycle and action facts; MCP is a live runtime system, not only configuration. |
| Copy Skills/Notes body prose density | The user explicitly rejects persistent explanatory text for expert operators. |
| Render page as nested cards | Conflicts with Studio framing law and creates visual noise. |
| Import app-server MCP internals in Studio | Violates runtime-store/browser contract boundary. |
| Expose provider direct MCP tools | Violates existing `mcpSystem` platform law; Studio should call runtime MCP facade. |
| Make SQL the only UI query surface | Powerful but too abstract/noisy for the default operational workflow. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: if the same low-noise/layout problem survives two self-review loops, return to plan/spec instead of patching UI.
- Custom exit condition from intent: `/mcp` is usable as an expert operator workbench with minimal persistent explanatory copy, no nested card stack, typed runtime-store boundaries, and desktop plus iPhone 14 evidence.
