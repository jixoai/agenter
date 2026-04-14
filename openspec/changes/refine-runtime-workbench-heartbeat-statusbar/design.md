## Context

The runtime shell already publishes the correct durable Heartbeat facts, but the WebUI still presents them inside a runtime-local `Scaffold` chrome that duplicates title and status inside the page body. `Workspaces` and `Messages` have already converged on `WorkbenchWindow + WorkbenchPageToolbar`; runtime is now the outlier.

The current Heartbeat implementation has also started adopting local ai-elements primitives, but it still lacks the surrounding workbench structure the user asked for: toolbar-first chrome, one clear scroll owner, a fixed footer statusbar, and virtualization for long message-part streams. The backend already exposes the data needed for the footer: latest model-call `response.usage` and attention `focusState` in the runtime preview.

## Goals / Non-Goals

**Goals:**

- Move runtime page chrome onto the shared workbench toolbar contract and remove duplicated in-body stage headers.
- Make Heartbeat a workbench-native conversation surface with virtualization and a persistent footer statusbar.
- Reuse existing runtime publication facts for context usage and focused/background/muted counts without inventing new APIs.
- Keep `Attention` and `Settings` on the same shell law so future footer/meta work can reuse the same structure.

**Non-Goals:**

- No session-db schema changes, no new tRPC endpoints, and no new telemetry capture protocol.
- No redesign of the `Attention` main-area or the `Settings` provenance editor beyond shell integration.
- No attempt to use the upstream ai-elements conversation implementation unchanged if it conflicts with the repository's `ScrollView` virtual law.

## Decisions

### 1. Runtime shell moves back to shared `WorkbenchWindow`

Use `WorkbenchWindow` as the runtime route shell and `WorkbenchPageToolbar` as the page-local chrome host. The first toolbar row carries title, avatar/workspace metadata, runtime status, and start/stop. The second row carries runtime-tab-local content such as `Heartbeat / Attention / Settings` labels and local actions.

Why:

- This restores one platform law for all workbench pages.
- It removes duplicated headers from the scrollable body.
- It gives Heartbeat more vertical room without inventing a runtime-specific layout exception.

Alternative considered:

- Keep the current runtime `Scaffold` and only move tabs upward.
- Rejected because it preserves a second shell law and keeps body-level chrome duplication alive.

### 1.1. Avatar catalog toolbar yields to runtime detail chrome

When a runtime or avatar-draft detail tab is active inside the avatars workbench, the catalog-level toolbar meta (`avatars / draft tabs / runtime tabs / New avatar`) stops rendering. The runtime page-toolbar becomes the only persistent toolbar row above the detail body.

Why:

- This is the actual space-saving change the operator asked for.
- It avoids stacking an avatar-catalog dashboard row above an already dense runtime inspection surface.
- It keeps catalog counts on the catalog route, where they are useful, without making runtime pages pay for them.

Alternative considered:

- Keep the avatar catalog toolbar visible on every avatar tab.
- Rejected because it leaves runtime with two chrome rows and fails the "free vertical room for content" goal in real browser inspection.

### 1.2. `WorkbenchPageToolbar` remains a single fixed-height row

`WorkbenchWindow` owns exactly one `48px` page-toolbar row. If both the layout-level toolbar snippet and the route-level `WorkbenchPageToolbar` portal are present, the portal host wins and the layout toolbar content yields instead of creating a second stacked row.

Why:

- The operator explicitly constrained this chrome to one row to prevent low-value metadata from pushing content downward.
- A hidden "row multiplier" makes the layout law meaningless because any feature can silently break the vertical budget.
- Host precedence preserves one durable extension point without adding more layout special cases.

### 2. Heartbeat virtualization is implemented as a local ai-elements adapter

Add a virtualized conversation adapter under the local ai-elements namespace and back it with `ScrollView virtual`. `Message`, `Checkpoint`, `Tool`, and `Reasoning` remain leaf presentation primitives; virtualization stays a list concern.

Why:

- The repository already treats scroll ownership and virtualization as platform primitives.
- The upstream conversation component does not solve the repository's long-list performance and ownership requirements by itself.
- This keeps Heartbeat rows semantically stable while swapping only the list container.

Alternative considered:

- Hand-roll virtualization directly inside `runtime-stage-heartbeat`.
- Rejected because it would make Heartbeat the owner of a reusable law that other AI inspection surfaces will likely need.

### 3. Heartbeat footer statusbar consumes existing runtime facts

The footer statusbar is fed by selectors built from current client state:

- `Context` reads the newest model call with `response.usage`.
- `Shimmer` reads `runtime.attention.snapshot.contexts[*].focusState` counts and the latest model-call `status`.

Why:

- The data already exists and is durable enough for this UI.
- It avoids unnecessary backend churn.
- The footer can degrade gracefully: hide or disable when facts are absent.

Alternative considered:

- Add a dedicated aggregated runtime footer API.
- Rejected for now because the current facts are sufficient and this would expand scope without solving a proven data gap.

### 4. Footer shell is standardized on the Heartbeat stage first

Heartbeat gets the first concrete footer statusbar because it is the runtime's primary inspection surface. `Attention` and `Settings` only adopt the same shell slots, not new footer content in this change.

Why:

- It solves the user-visible problem immediately.
- It avoids forcing fake footer content into secondary tabs.
- It leaves a durable extension point for later runtime chrome refinement.

### 5. Runtime body does not add a second padded card around Heartbeat

The `WorkbenchWindow` body already owns the runtime route's rounded border and outer padding contract. `runtime-shell` therefore stays edge-to-edge inside that body, and `Heartbeat` does not wrap itself in another rounded bordered card.

Why:

- A second shell layer wastes vertical space in the highest-density runtime inspection view.
- Double borders and nested radii make the operator think the transcript is a card inside another card instead of the primary page surface.
- The Heartbeat stage should own transcript flow and footer signals, not re-implement the outer frame.

## Risks / Trade-offs

- [Virtual row measurement can regress Storybook browser tests] → Reuse the repository's existing `ScrollView virtual` pattern and keep Storybook DOM coverage focused on observable row rendering, footer visibility, and toolbar composition.
- [Toolbar migration could disturb compact/mobile runtime layout] → Reuse `WorkbenchToolbar` responsive breakpoints and add compact Storybook coverage for the runtime shell.
- [Avatar detail routes could lose their top-level context after the catalog toolbar collapses] → Keep the catalog tab strip intact and let the runtime page-toolbar carry title/workspace/status so the route still has one clear source of context.
- [Latest model call may exist without usage] → Render `Context` in disabled/hidden fallback states instead of inventing estimated numbers.
- [Existing uncommitted Heartbeat ai-elements work may drift from the final shell contract] → Integrate the current local ai-elements files as the baseline and only expand them where the new shell/statusbar contract requires it.
