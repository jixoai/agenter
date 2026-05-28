## Context

`shell-next` already has the right macro architecture:

- OpenCompose / `renderable-mux` own pane layout, pane chrome, focus routing, resize handles, and source-family composition.
- Pane content comes from two families:
  - custom-render panes;
  - OpenTUI `cliRenderer` / renderable panes.
- Terminal panes are a special case of custom-render panes. They project PTY + termless + `ghostty-native(vt)-backend` truth into the host renderer.

The current failures come from violating that boundary. Terminal interaction behavior is still partly owned by the Shell/OpenCompose view path:

- semantic double/triple click detection still exists in the terminal frame/view path;
- drag-selection lifecycle still exists partly above the backend truth;
- Shell selection feels flaky because raw events, gesture state, and backend selection truth are still split across multiple layers.

The user clarified the intended law:

1. `把这些行为归置到合理的地方，在内核层去做，而不是在Shell-next这个应用层去做`
2. `用开关的方式、或者更简单点用注释的方式，把代码收敛到“单层”，也就是 termless-ghostty-native-backend 这里实现所有的 Input 处理`
3. `双击选词、三击选行` is not a pane default. For custom-render panes it should not exist by default. For `cliRenderer` panes it is an opt-in extension, comparable to `useMouseSelectionBehavior(cliRenderer)`.

This change therefore treats terminal interaction as a platform-law correction, not as another bugfix pass.

## Goals / Non-Goals

**Goals**

- Collapse terminal-specific interaction ownership to one lower layer for custom terminal panes.
- Make Shell/OpenCompose terminal views raw event adapters and visual projectors only.
- Define renderer-pane semantic mouse selection as an explicit opt-in plugin instead of a default pane law.
- Reproduce and lock the current failures with BDD before implementation.
- Keep future exceptions explicit: if a higher-layer patch is still needed after the collapse, it must be named and justified as a special case, not smuggled back as the default law.

**Non-Goals**

- Promote this behavior into OpenCompose itself.
- Change renderer-pane copy/selection behavior that is already correct unless it is directly touched by the new plugin contract.
- Modify `extensions/cli-shell`.
- Introduce tmux/psmux/native-addon work.

## Original Product Intent

The design and self-review for this change must stay aligned to these exact user statements:

1. `关于Shell，你不能这样去解决问题，你可以用开关的方式、或者更简单点用注释的方式，把代码的收敛到“单层”，也就是 termless-ghostty-native-backend这里实现所有的Input处理。再次基础上如果发现真正解决不了的问题才能通过对我特殊申请权限的方式，来在其它层去做特别的Patch。这不是倒退，而是以退为进，在这个过程中，我们就可以把之前那的开关或者注释慢慢放开。`
2. `双击选词、三击选行的语义判断还在 Shell/OpenCompose 这一侧，我们有两种Pane，一种自定义渲染，这种模式下绝对不包含“双击选词、三击选行的语义判断”，一种是内置的对cliRenderer复合渲染，这种情况下，“双击选词、三击选行的语义判断”属于我们对cliRenderer开发的扩展行为，也和OpenCompose无关。`
3. `continue，2/3问题比较复杂，必须在openspec基础上去推进。`

## Decisions

### 1. Custom terminal panes get one interaction owner

For terminal-protocol/custom terminal panes, durable interaction truth belongs to the shell-next Terminal Interaction Kernel boundary:

- normal key input;
- paste input;
- mouse drag selection;
- semantic word/line selection;
- selection clear/copy;
- scroll-aware anchor/focus evolution;
- viewport follow / auto-return to cursor.

The Shell/OpenCompose view path only does:

- coordinate translation;
- raw mouse/keyboard intent forwarding;
- paint backend frame/cursor/selection overlays.

Alternative considered: keep semantic click and drag-selection state in the frame/view layer and only forward resulting callbacks. Rejected because it preserves split ownership and keeps scroll semantics in the wrong layer.

### 2. “Single-layer first” beats clever fallback layering

The implementation should first collapse behavior to one lower layer, even if that temporarily disables view-layer helpers or leaves explicit TODO/commented seams. If a real gap remains afterward, any higher-layer patch must be introduced as a named exception after discussion.

Alternative considered: keep both layers alive with guards and “best effort” coordination. Rejected because that is how the current flakiness happened.

### 3. Pane law and content law are different things

OpenCompose pane law stays generic:

- layout;
- focus;
- chrome;
- hit testing;
- resize handles;
- source-family mounting.

Content law belongs to the pane family:

- custom terminal pane content gets backend-owned terminal interaction law;
- `cliRenderer` pane content may opt into a mouse-selection plugin.

This means OpenCompose itself must not know “double-click selects word” or “triple-click selects line”.

Alternative considered: keep semantic click support as a convenience in generic pane code. Rejected because it would leak terminal/editor semantics into games and other renderer-pane content.

### 4. Renderer selection becomes an opt-in plugin contract

For `cliRenderer` panes, semantic mouse selection is modeled as an explicit extension point, conceptually:

- `useMouseSelectionBehavior(cliRenderer)`

The important law is not the exact API name; it is that:

- default pane composition does not imply semantic double/triple click behavior;
- renderer-pane code opts in intentionally when it wants that behavior.

Chat/Room can consume this plugin. A game-like renderer pane should be able to omit it entirely.

### 5. BDD must target the boundary, not just the symptom

The new BDD has to prove:

- Shell custom terminal panes no longer keep durable selection state in the view layer;
- semantic word/line selection survives full click release because backend/kernel owns it;
- renderer panes only get semantic selection behavior when the explicit plugin is installed;
- generic pane composition stays free of double/triple-click selection assumptions.

## Risks / Trade-offs

- Collapsing to one lower interaction owner may temporarily disable some view-layer conveniences until the backend/kernel implementation catches up. This is acceptable because the point is to stop drifting further from the correct law.
- Some current tests may need to move down a layer because app-level mocks cannot prove ownership boundaries.
- If `ghostty-native(vt)-backend` lacks one piece of behavior, we may need a small shell-next internal adapter around it. That is still lower-layer ownership, not app-layer behavior.

## Implementation Shape

1. Add a shell-next-internal Terminal Interaction Kernel module boundary.
2. Route custom terminal pane mouse/keyboard intents into that boundary.
3. Remove semantic click and durable drag-selection ownership from the OpenCompose terminal frame/view path for custom terminal panes.
4. Introduce or formalize a renderer selection plugin contract for `cliRenderer` panes.
5. Migrate Chat/Room renderer panes to that plugin if they need semantic word/line selection.
6. Re-run BDD and self-review against the original wording above.

## Self-Review Discipline

This change must include:

- BDD-first coverage for the boundary changes;
- multi-turn self-review aligned to the exact user wording;
- at most five explicit implementation/self-review rounds before merging the notes into one drift list and one encountered-problems list.
