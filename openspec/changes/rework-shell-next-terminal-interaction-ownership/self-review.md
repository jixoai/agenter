## Round 1: Single-layer first

- What we wanted:
  - Shell custom terminal panes should stop owning durable selection truth in the Shell/OpenCompose view layer.
  - Higher layers should only forward raw intent and paint what the lower layer says.
- What changed:
  - The renderer-side semantic selection behavior was isolated into `extensions/shell-next/src/renderable-mux/renderer-selection.ts`.
  - That behavior is only installed by renderer panes that explicitly opt in.
  - No new terminal-specific selection behavior was added back into generic pane composition.
- Result:
  - This round stayed aligned with the "collapse to one lower owner first" requirement.
  - The remaining higher-layer behavior is explicit and local instead of being smuggled into pane defaults.

## Round 2: Custom terminal pane vs `cliRenderer` pane

- What we wanted:
  - Custom terminal panes and `cliRenderer` panes are different pane families.
  - Double-click word selection and triple-click line selection are never the default law for all panes.
- What changed:
  - Renderer-pane semantic selection now lives behind the `ShellNextRendererSelectionTarget` contract.
  - Chat/Help/Room renderer surfaces explicitly install that behavior.
  - Room transcript rows needed their own `resolveLocalPoint(...)` projection seam because visible row coordinates inside `ScrollBox` are not the same thing as plain screen coordinates.
- Result:
  - Renderer panes now get semantic selection only by explicit installation.
  - Generic renderer panes stay neutral.
  - Custom terminal panes do not inherit renderer selection semantics by accident.

## Round 3: OpenCompose stays generic

- What we wanted:
  - OpenCompose should keep owning layout, pane chrome, focus routing, hit testing, resize, and source-family composition.
  - OpenCompose should not gain terminal/editor semantics such as double-click word selection.
- What changed:
  - The new behavior stays inside shell-next-local files.
  - No OpenCompose API was widened for terminal/editor-specific mouse semantics.
  - The neutral-path proof lives in `extensions/shell-next/test/renderer-grid-demo.test.ts`.
- Result:
  - This round preserved the generic pane law.
  - Semantic selection stayed at the content-family layer, not the pane-layout layer.

## Drift list

- Earlier attempts still mixed terminal semantics and renderer semantics in the same troubleshooting path. This round corrected that by drawing the pane-family boundary explicitly.
- Earlier tests tried to prove the Room migration through app-level double-click timing. That was the wrong boundary. The stable proof moved to the surface boundary and explicit plugin contract.

## Encountered problems

- `ScrollBox`-hosted transcript rows needed explicit event-to-local coordinate projection. Naive `screenY` math was not enough.
- Renderer double-click timing through the higher app shell was flaky for BDD. Surface-level event injection was more reliable and matched the architectural seam better.
- Middle-click selection preservation had to stay explicit without inventing a second clipboard track. The final behavior kept the single-path rule.
