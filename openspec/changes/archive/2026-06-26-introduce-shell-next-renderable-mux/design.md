## Context

The current `agenter-app-shell` app uses tmux as the native host/compositor. That made sense while the earlier FrameBuffer/offscreen terminal path was unstable, but it now creates the wrong incubation boundary: the app depends on a globally installed tmux/psmux runtime, and the codebase cannot mature a reusable embedded mux API while tmux owns split layout, focus, status, and pane hosting.

The new work starts in `apps/shell-next` instead of rewriting `apps/cli-shell` in place. `shell-next` is an incubation app, not a published package. It must be architected so the generic pieces can later move into an independent package while the app-specific pieces remain in the Agenter extension.

The user-facing app story is intentionally simple for the first iteration: run `bun agenter shell2`, see a native TTY shell surface, split panes like tmux, route input to the focused pane, and reuse existing cli-shell room/help/top-layer capabilities only where they do not drag tmux coupling into the new runtime.

The current terminal rendering law must be kept precise:

- `TerminalSystem` is an application/runtime instance concept.
- Terminal offscreen rendering is implemented by `termless + ghostty-native (VT)` or another Termless backend.
- A pane source is not automatically a `TerminalSystem` live mirror. A pane source is normalized into a shell-next render/layout boundary.
- For terminal panes, the stable boundary is the existing terminal protocol channel: frame/input/resize/viewport/lifecycle messages.

## Goals / Non-Goals

**Goals:**

- Create `apps/shell-next` as a clean incubation area.
- Provide local `bun agenter shell2` routing without changing stable `bun agenter shell`.
- Build a tmux-like layout surface using OpenTUI low-level `Renderable` and layout APIs.
- Produce reusable renderable primitives such as `PaneRenderable`, `RootLayout`, and `ChildLayoutNode` rather than a app-only screen.
- Keep shell-next architecture separable into future packages:
  - generic renderable mux/layout primitives,
  - terminal-pane projection primitives,
  - pane source adapters,
  - Agenter shell app wiring.
- Reuse proven cli-shell atoms when they are orthogonal to tmux:
  - app bootstrap/client-sdk binding,
  - argument parsing conventions,
  - room/help/top-layer OpenTUI surfaces,
  - terminal frame renderable and live mirror concepts,
  - terminal input encoding,
  - settings/test harness patterns.
- Keep Termless/Ghostty backend truth backend-owned; shell-next renderables project and route, not reinterpret terminal output.
- Include an OpenTUI-native statusbar in MVP that mirrors Studio Heartbeat's macro status and AI context summary.

**Non-Goals:**

- Do not rename `apps/cli-shell` or publish shell-next in this change.
- Do not replace `bun agenter shell` until shell-next passes acceptance.
- Do not depend on external tmux/psmux for the shell-next primary path.
- Do not implement a full tmux command/config compatibility layer.
- Do not build a native addon in this change.
- Do not move generic code into a final `@jixo/tmux` or package namespace before the incubation API stabilizes.
- Do not let app concepts such as Avatar, MessageRoom, TerminalSystem, AttentionSystem, or launcher descriptors leak into the generic renderable mux model.
- Do not include selection/copy in the shell-next MVP. Those remain future terminal interaction capabilities owned by the pane source/backend.

## Decisions

### 1. Shell-next owns an embedded renderable mux, not a tmux adapter

`shell-next` will define a local mux runtime that can host multiple panes inside one OpenTUI renderer. The runtime owns:

- pane identity,
- layout tree,
- focus state,
- resize allocation,
- keyboard/mouse routing,
- composed render invalidation.

External tmux may remain useful as a comparison target, but it is not the implementation law for shell-next.

Rejected alternative: Keep building around `@agenter/tmux-client`.

- Rejected because that preserves the global tmux dependency and keeps layout truth outside our code.

### 2. The terminal pane boundary is the protocol channel

The normalized terminal pane source is the existing terminal protocol channel. This is the boundary that carries terminal frame truth, input, resize, viewport, dirty/pull pacing, and lifecycle events.

Pane sources are modeled as adapters into that boundary:

1. **Protocol channel source**: an already available terminal protocol channel can be consumed directly.
2. **Bun PTY source**: a local `Bun.Terminal` process is started, its output is fed into the offscreen Termless/Ghostty VT backend, and the result is exposed as the same protocol channel.
3. **CommandTask source**: a command task is lowered into a Bun PTY launch, then follows the same PTY-to-protocol adapter path.
4. **Optional OpenTUI renderable source**: an OpenTUI renderer/renderable object, such as something created through `createCliRenderer`, may be mixed into the layout tree as a non-terminal renderable source. It does not pretend to be VT terminal truth unless it explicitly adapts to the terminal protocol.

This corrects the earlier "TerminalSystem live mirror" wording. `TerminalSystem` can be one producer of a protocol channel, but it is not the pane source law.

### 3. The core model is framework-shaped but app-free

The reusable core inside shell-next should start as app-free TypeScript modules:

```txt
renderable-mux/
  model.ts         pane registry, focus, mux commands
  pane-source.ts   normalized pane source contracts and adapters
  geometry.ts      split/resize/adjacency calculations
  layout.ts        RootLayout and ChildLayoutNode state
  events.ts        normalized mux input/event types
  renderable.ts    OpenTUI Renderable projection
```

This is not a final package boundary yet, but the folder boundary should make extraction straightforward.

Rejected alternative: Put everything in `run-shell-next.ts`.

- Rejected because it would reproduce the current app-shell coupling and make later package extraction expensive.

### 4. `PaneRenderable` is a projection atom, not a layout owner

`PaneRenderable` should be the main reusable atom for projecting one terminal pane in an OpenTUI context. It should combine:

- a stable assigned pane frame rectangle,
- backend-owned cell/cursor/viewport facts,
- focus/cursor projection,
- input bridge hooks,
- lifecycle hooks for resize/dispose.

It must not:

- create Avatar sessions, MessageRoom bindings, TerminalSystem instances, Bun PTYs, or CommandTasks by itself,
- compute split/focus/resize layout,
- own selection/copy in MVP,
- parse ANSI bytes or maintain a second terminal buffer.

App code supplies a pane source. Layout code supplies the rectangle. `PaneRenderable` only renders the source's current frame and forwards user input to the source.

The existing cli-shell terminal frame and live mirror code can seed this implementation, but the new primitive must have a cleaner constructor boundary and a smaller app surface.

### 5. Layout is its own primitive: `RootLayout` plus `ChildLayoutNode`

Split, focus, resize, minimum size, and hit testing belong to a separate layout system. The intended shape is similar to a small document tree:

- `RootLayout` acts as the root context/document for a shell-next surface.
- `ChildLayoutNode` stores child layout state, split axis, pane/source id, relative weights, and the last assigned rectangle.
- Layout commands mutate layout state and then assign rectangles to child renderables.
- Renderables consume assigned rectangles; they do not decide sibling geometry.

The first layout model should use tmux-like split semantics:

```txt
node =
  split(axis: horizontal | vertical, children[])
  pane(paneId)
  renderable(renderableId)
```

The model should support:

- split left/right/above/below,
- close pane,
- focus adjacent node,
- resize focused node by edge/delta,
- recompute rectangles after host resize,
- stable minimum pane dimensions,
- event hit testing.

The implementation should follow tmux source behavior for minimum pane sizing instead of inventing a local constant. As of the inspected upstream `tmux.h`, `PANE_MINIMUM` is `1`; `layout.c` then adds separator, scrollbar, and pane-border-status costs when split/resize checks require more space. Implementation must pin the tmux source revision it used and encode the equivalent rule in tests.

The implementation may borrow tmux layout behavior as a reference, but it should not embed tmux source objects such as window, window_pane, options, or server redraw.

### 6. OpenTUI renderables can mix with terminal panes

Because shell-next is developed against OpenTUI, the layout tree must be able to host both terminal pane renderables and ordinary OpenTUI renderables. This is how Help, top-layer approval UI, statusbar, and future non-terminal surfaces can stay native to OpenTUI instead of becoming fake terminal panes.

Pane sources now follow a two-family rule:

- **Terminal protocol family**: protocol channel, Bun PTY, and CommandTask sources are for process-backed terminal truth. They remain first-class when the thing being hosted is a real terminal process or should be isolated as terminal I/O.
- **OpenTUI renderable family**: OpenTUI renderable sources are for in-process app UI surfaces, such as internal Room/Help/statusbar work where using OpenTUI directly is more efficient for development and avoids fake terminal panes.

These are independent source families, not fallback levels. The four-pane demo only gates whether the OpenTUI renderable family is viable for direct in-process surfaces; it does not replace the BunPTY/protocol family.

Viability is decided by a demo gate, not by discussion alone: build a four-pane layout demo that mounts four independent OpenTUI renderable surfaces under one root OpenTUI renderer, then verify click and selection behavior. The user manually verified `bun run agenter shell2 renderer-grid-demo` as working perfectly, so direct OpenTUI renderable mixing is accepted as a first-class MVP source family. This MVP demo intentionally does not claim that multiple `createCliRenderer()` instances can be nested into the same terminal; that would require a separate offscreen renderer compositing experiment. The demo may compare against native tmux behavior, but native tmux is only a reference target, not the shell-next architecture.

This keeps `PaneRenderable` terminal-specific while allowing the layout system to become the more general composition primitive.

### 7. App wiring stays outside renderable primitives

The Agenter-specific shell-next app layer owns:

- `shell2` argv grammar,
- app bootstrap,
- runtime terminal binding,
- Bun PTY / CommandTask launch policy,
- room binding,
- Avatar identity,
- settings,
- shell assistant facts,
- cleanup/migration helpers later.

The renderable mux only consumes abstract pane sources and emits abstract pane actions.

### 8. `shell2` is local and temporary

The launcher will register a `shell2` app command that resolves locally to `apps/shell-next`. It should not be treated as the future package name or published command. It is a side-by-side acceptance entry that allows comparing old `shell` and new `shell2`.

### 9. Statusbar is MVP and uses Studio Heartbeat's macro model

The shell-next MVP should include an OpenTUI-native statusbar. It should not show AttentionItem content. It should migrate the macro status model from Studio Heartbeat:

- runtime status label and detail, such as `Idle`, `Running`, `Waiting`, `Backoff`, or `Blocked`,
- AttentionContext focus outline, such as `21 focused · 2 background · 2 muted`,
- AI context usage summary/progress, such as `0.7%`.

The implementation should reuse the same semantic derivation as Studio Heartbeat where practical:

- `buildHeartbeatStatusState(...)` style status summary,
- `buildHeartbeatAttentionFocusSummary(...)` style AttentionContext counting,
- `buildHeartbeatContextState(...)` style model-call/context usage summary.

The statusbar is app chrome built with OpenTUI renderables. It is not part of `PaneRenderable`, and it does not become an AttentionItem renderer.

On narrow terminals, the statusbar priority rule is fixed:

- right-side actions such as Help and Chat remain visible first,
- the left summary occupies the remaining width and overflows with truncation/ellipsis,
- left summary segments are ordered by importance from left to right so the most important information survives longest under truncation.

### 10. Testing starts from behavior contracts

BDD coverage should start before heavy UI work:

- layout model unit tests for split/resize/focus,
- tmux-source-backed tests for minimum pane sizing behavior,
- four-pane OpenTUI renderable mixing demo tests for click/selection viability,
- pane source adapter tests for protocol channel, Bun PTY, and CommandTask lowering,
- renderable tests with OpenTUI test renderer,
- statusbar derivation tests for Heartbeat macro summary,
- app launcher tests proving `shell2` routes locally and `shell` remains unchanged,
- focused integration test for `shell2` startup and one split/focus workflow once the runtime exists.

This change does not require full native manual acceptance yet, but tasks should leave that gate explicit.

### 11. App completion requires the existing FrameBuffer projection stack

Sections 1-7 establish the mux/layout foundation only. App completion requires shell-next terminal panes to reuse the already proven cli-shell terminal projection stack rather than treating terminal frames as plain text:

- `BackendTerminalFrameRenderable` owns the OpenTUI frame surface and scrollbar gutter.
- `ShellTerminalViewRenderable` owns the terminal FrameBuffer projection.
- `FrameBufferRenderable` remains the low-level drawing primitive for rich terminal cells.
- `createCliShellLiveTerminalMirror` remains the adapter for real TerminalSystem transport URLs.

The renderable mux core must not import cli-shell. It should expose a terminal pane factory extension point, and shell-next app wiring can choose the frame-backed adapter. Local BunPTY sources may still be independent process-backed sources, but their snapshots must carry the same backend-owned facts needed by the frame-backed projection: rich lines, cursor, viewport start, and scrollback rows.

Help and Chat are app surfaces/actions, not mux laws. They should remain visible as OpenTUI-native actions in shell2, while the eventual Room integration can select either a direct OpenTUI renderable source or an isolated BunPTY/protocol source based on the hosted surface nature.

## Risks / Trade-offs

- [Risk] Reusing cli-shell code may import tmux assumptions into shell-next.
  - Mitigation: classify reused code as either app wiring, terminal projection, OpenTUI surface, or tmux-host residue before copying. Do not reuse tmux host/status/action modules in the generic mux layer.
- [Risk] OpenTUI layout/render invalidation may not be enough for high-frequency terminal repaint.
  - Mitigation: keep pane frame replay and render pacing explicit; test with the existing FrameBuffer/live mirror patterns before adding app chrome.
- [Risk] Renderable APIs may harden too early and block later extraction.
  - Mitigation: keep shell-next private/local, use narrow constructor interfaces, and defer package export until acceptance.
- [Risk] `shell2` could be mistaken for a supported public command.
  - Mitigation: document it as local incubation and keep existing `shell` descriptor stable.
- [Risk] Shell-next may duplicate current cli-shell app code.
  - Mitigation: duplicate only during incubation when needed, but record extraction candidates in tasks and keep reusable modules app-free.
- [Risk] Direct OpenTUI renderable mixing may couple shell-next to an implementation detail of current Room.
  - Mitigation: model OpenTUI renderable mixing and BunPTY/protocol hosting as independent pane source families selected by source nature, not as fallback levels.

## Migration Plan

1. Introduce `apps/shell-next` and `shell2` as an isolated local command.
2. Define normalized pane source contracts and adapters around the terminal protocol channel.
3. Build and verify `RootLayout`/`ChildLayoutNode` plus `PaneRenderable` without touching stable `shell`.
4. Add OpenTUI-native statusbar and verify Heartbeat macro summary derivation.
5. Reuse app bootstrap and room/help/top-layer atoms only after the pane/layout runtime is testable.
6. Compare shell-next native behavior against cli-shell tmux behavior for startup, split/focus, resize, statusbar, and room/help access.
7. After acceptance, perform a separate rename change:
   - current `apps/cli-shell` -> shell legacy location/name,
   - `apps/shell-next` -> stable shell,
   - `shell2` removed or aliased back to `shell`.

## Evidence Gates

No contract-level open questions remain. Implementation evidence still required:

- pin the tmux source revision used for minimum pane sizing parity,
- implement the independent terminal protocol and OpenTUI renderable source contracts,
- keep source selection based on whether the source is process/terminal-backed or in-process OpenTUI UI.
