## 1. OpenSpec And Boundary Audit

- [ ] 1.1 Record the current split ownership paths for custom terminal panes: view-layer semantic click handling, drag-selection lifecycle, backend selection truth, and renderer-pane selection behavior.
- [ ] 1.2 Confirm `extensions/cli-shell` stays read-only and identify only the behavior references needed from `legacy/terminal2`.
- [ ] 1.3 Record the two pane families explicitly in the change audit: custom-render panes vs `cliRenderer` panes.

## 2. BDD For Ownership Collapse

- [ ] 2.1 Add failing BDD scenarios proving custom terminal panes do not keep durable selection truth in the Shell/OpenCompose view layer.
- [ ] 2.2 Add failing BDD scenarios proving semantic double-click word selection and triple-click line selection remain visible through mouseup because backend/kernel owns the selection.
- [ ] 2.3 Add failing BDD scenarios proving renderer panes only get semantic mouse selection behavior when the explicit plugin/extension is installed.
- [ ] 2.4 Add failing BDD scenarios proving generic pane composition does not implicitly add double/triple-click selection semantics to arbitrary renderer content.

## 3. Terminal Interaction Kernel Refactor

- [ ] 3.1 Introduce or tighten a shell-next internal Terminal Interaction Kernel boundary for custom terminal panes.
- [ ] 3.2 Move remaining semantic click and durable drag-selection ownership out of the OpenCompose terminal frame/view path for custom terminal panes.
- [ ] 3.3 Keep the view path limited to raw event forwarding, coordinate translation, and visual projection.
- [ ] 3.4 Keep any temporary guards/comments/switches explicit so the code clearly shows the “single-layer first” collapse.

## 4. Renderer Selection Plugin Law

- [ ] 4.1 Define the renderer-pane opt-in selection behavior contract for `cliRenderer` content.
- [ ] 4.2 Migrate Chat/Room renderer panes to the explicit plugin path if they require semantic mouse selection.
- [ ] 4.3 Verify that custom-render panes do not inherit renderer selection semantics by default.

## 5. Verification And Self Review

- [ ] 5.1 Self review round 1: compare implementation against the “single-layer first” requirement in plain language.
- [ ] 5.2 Self review round 2: compare implementation against the “custom terminal pane vs cliRenderer pane” law.
- [ ] 5.3 Self review round 3: compare implementation against the “OpenCompose stays generic” law.
- [ ] 5.4 Merge the review notes into one drift list and one encountered-problems list.
- [ ] 5.5 Run focused shell-next BDD for terminal interaction ownership and renderer selection plugin behavior.
- [ ] 5.6 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [ ] 5.7 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [ ] 5.8 Run `git diff --check`.
- [ ] 5.9 Confirm `git diff -- extensions/cli-shell` is empty.
