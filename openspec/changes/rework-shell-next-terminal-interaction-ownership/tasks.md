## 1. OpenSpec And Boundary Audit

- [x] 1.1 Record the current split ownership paths for custom terminal panes: view-layer semantic click handling, drag-selection lifecycle, backend selection truth, and renderer-pane selection behavior.
- [x] 1.2 Confirm `extensions/cli-shell` stays read-only and identify only the behavior references needed from `legacy/terminal2`.
- [x] 1.3 Record the two pane families explicitly in the change audit: custom-render panes vs `cliRenderer` panes.

## 2. BDD For Ownership Collapse

- [x] 2.1 Add failing BDD scenarios proving custom terminal panes do not keep durable selection truth in the Shell/OpenCompose view layer.
- [x] 2.2 Add failing BDD scenarios proving semantic double-click word selection and triple-click line selection remain visible through mouseup because backend/kernel owns the selection.
- [x] 2.3 Add failing BDD scenarios proving renderer panes only get semantic mouse selection behavior when the explicit plugin/extension is installed.
- [x] 2.4 Add failing BDD scenarios proving generic pane composition does not implicitly add double/triple-click selection semantics to arbitrary renderer content.

## 3. Terminal Interaction Kernel Refactor

- [x] 3.1 Introduce or tighten a shell-next internal Terminal Interaction Kernel boundary for custom terminal panes.
- [x] 3.2 Move remaining semantic click and durable drag-selection ownership out of the OpenCompose terminal frame/view path for custom terminal panes.
- [x] 3.3 Keep the view path limited to raw event forwarding, coordinate translation, and visual projection.
- [x] 3.4 Keep any temporary guards/comments/switches explicit so the code clearly shows the “single-layer first” collapse.
- [x] 3.5 Move host keyboard and pointer input state machines into `packages/termless-core` and make terminal sources own them directly.
- [x] 3.6 Delete the obsolete `extensions/shell-next/src/terminal-engine/*` path after the source-owned adapters are in place.

## 4. Renderer Selection Plugin Law

- [x] 4.1 Define the renderer-pane opt-in selection behavior contract for `cliRenderer` content.
- [x] 4.2 Migrate Chat/Room renderer panes to the explicit plugin path if they require semantic mouse selection.
- [x] 4.3 Verify that custom-render panes do not inherit renderer selection semantics by default.

## 5. Verification And Self Review

- [x] 5.1 Self review round 1: compare implementation against the “single-layer first” requirement in plain language.
- [x] 5.2 Self review round 2: compare implementation against the “custom terminal pane vs cliRenderer pane” law.
- [x] 5.3 Self review round 3: compare implementation against the “OpenCompose stays generic” law.
- [x] 5.4 Merge the review notes into one drift list and one encountered-problems list.
- [x] 5.5 Run focused shell-next BDD for terminal interaction ownership and renderer selection plugin behavior.
- [x] 5.6 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 5.7 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 5.8 Run `git diff --check`.
- [x] 5.9 Confirm `git diff -- extensions/cli-shell` is empty.
- [x] 5.10 Verify `Run in Background` preserves product-bound terminal sources while `Terminate terminal` still disposes them.
