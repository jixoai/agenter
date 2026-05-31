## Context

The terminal route already has a durable split of responsibilities:

- the left side owns the terminal stage and tool composer
- the right side owns activity and collaboration management

The problem is only the shell primitive. `SplitView` gives a static two-column shell, while the rest of the workbench has moved to `WorkbenchSplitDetail` for resizable desktop detail rails and shared compact-collapse math. Terminal therefore diverges from the platform law even though it matches the same `main + right detail` shape.

## Goals / Non-Goals

**Goals:**

- Move the terminal route to the shared split-detail shell law.
- Keep existing terminal content surfaces intact instead of rewriting the stage pane, actions rail, or user-management internals.
- Preserve terminal accessibility on compact widths by keeping the detail rail reachable through the shared right-sheet fallback after the split collapses.
- Add regressions that lock the terminal surface to the shared split-detail law.
- Move terminal route-local identity and detail-view switching into the shared `page-toolbar` host so the shell no longer shows static app copy while the real route controls live deeper in the page.
- Surface current terminal runtime facts through the shared page-toolbar `status` slot instead of leaving running/busy state implicit inside the stage body.
- Flatten the terminal route out of the oversized `WorkbenchWindow` body card so the stage pane and the detail rail own visual surfaces directly.
- Extract one shared actor selector primitive for avatar-bearing actor choice surfaces instead of repeating custom `Select` markup in terminal and message pages.
- Keep the right rail as a full-height `Actions` surface with its own scroll owner while opening terminal user management through a dedicated dialog instead of competing for the same column.
- Keep toolbar help inside the shared help-hint affordance without letting compact shell chrome occlude the popup.
- Reuse the same structured tool invocation viewer stack as Heartbeat so terminal action facts stop diverging visually from other systems.
- Move both terminal write and terminal read affordances onto the same `InputGroup` composer law so the stage owns one bottom action surface instead of a detached footer row.

**Non-Goals:**

- Invent a terminal-only compact detail model outside the shared `WorkbenchPageContent` split-detail host.
- Change terminal activity data, terminal transport, or terminal collaboration behavior.
- Introduce PTY lifecycle toolbar actions before the shared app-kernel, TRPC router, and client SDK expose explicit bootstrap / kill contracts.
- Introduce a terminal-specific sheet or stacked mobile interaction model for terminal detail.
- Redesign terminal creation flow or add a new generic terminal route shell outside the selected-terminal page.

## Decisions

### Use `WorkbenchPageContent` as the split-detail host

Once the terminal composer moved into the stage body, the route became a standard `main + drawer` page again:

- the stage pane owns the transcript plus the bottom action composer
- the right side owns the `Actions` rail
- `Users` already moved into a separate dialog instead of competing for drawer space

That means the correct host is no longer a terminal-local `WorkbenchSplitDetail.Root` composition. The correct host is the shared `WorkbenchPageContent` split-detail wrapper, because it already defines:

- persistent desktop split behavior
- compact right-sheet fallback
- toolbar close-takeover choreography while the compact sheet is open

Alternative considered:

- Keep wiring `WorkbenchSplitDetail` directly in the terminal page and continue reimplementing compact fallback locally: rejected because that recreates shell policy in feature code and immediately diverges from the rest of the workbench.

### Persist desktop ratio with a dedicated terminal key

The split uses a string persistence key so the terminal route reuses the shared IndexedDB + BroadcastChannel ratio source instead of inventing route-local storage. The key stays terminal-surface scoped so it does not collide with workspace settings or other split-detail adopters.

Alternative considered:

- No persistence: rejected because it would keep terminal behind the rest of the shared workbench split-detail contract.

### Compact fallback reuses the shared right sheet instead of stacking the rail below the stage

The terminal page should not invent a terminal-only compact behavior. Once the route uses `WorkbenchPageContent` as its host, compact widths should follow the same law as other split-detail pages:

- the main stage remains visible
- the `Actions` drawer becomes a right sheet
- the toolbar `Actions` affordance opens that sheet
- `Users` remains a dedicated dialog, so compact mode still keeps one concern per surface

This keeps compact behavior aligned with the rest of the application and removes one more feature-local layout policy.

Alternative considered:

- Stack the `Actions` rail below the stage on compact widths: rejected because it bypasses the shared compact-sheet law and forces terminal to own a second responsive layout system.

### Let the selected terminal route own page-toolbar content

`terminals-workbench-layout` should keep owning tab chrome, but it should stop trying to describe the active selected-terminal page with static copy. The selected terminal route is the authority on:

- which terminal is active
- which runtime state (`running/stopped`, `busy/idle`) is authoritative
- whether the users management dialog is open
- which route-local explanation belongs in help

The page therefore injects `TerminalPageToolbarContent` through `WorkbenchPageToolbar`, mirroring the messages workbench pattern. This keeps the page-toolbar as a host law while moving route-specific identity into the route atom that actually knows the facts.

Alternative considered:

- Keep a local terminal summary toolbar in `terminals-workbench-layout` and merely add more controls inside the page: rejected because it duplicates identity across layers and leaves the route switching choreography split between shell and page internals.

### Keep toolbar status authoritative and defer PTY lifecycle buttons

The terminal control plane already knows how to start and kill PTYs internally, but that capability is not yet exposed as a shared page-safe contract through:

- `app-kernel`
- the app-server TRPC router
- the client SDK runtime store

That means the page-toolbar can currently do one correct thing and one incorrect thing:

- correct: render authoritative runtime facts already present on `GlobalTerminalEntry` (`running` and `status`)
- incorrect: invent fake `bootstrap` / `kill pty` buttons or overload an unrelated action such as terminal deletion

The current change therefore keeps the toolbar honest:

- the `status` slot shows `running/stopped` plus `busy/idle`
- PTY lifecycle actions remain deferred until the platform exposes explicit mutations end to end

Alternative considered:

- Reuse `deleteGlobalTerminal` as a pseudo-`kill pty` action or add optimistic UI buttons before backend support exists: rejected because it would blur route semantics, hide the real platform gap, and force the frontend to guess about PTY lifecycle state.

### Remove the outer giant body card from the terminal workbench window

The terminal page already uses pane surfaces for the stage and the right detail rail. Wrapping both inside a second rounded card violates the current workbench design law that shells should not own decorative surfaces when content panes already do. The terminal workbench should therefore switch its shared window body to:

- `bodyMode="fill"` so the route keeps scroll/layout ownership
- `rounded-none border-0 bg-transparent shadow-none` body chrome so the outer shell stops masquerading as a second content card

Alternative considered:

- Rebuild the terminal workbench with a bespoke `ClipSurface` shell like messages: rejected for now because `WorkbenchWindow` already provides the needed tab chrome and toolbar host; only its body treatment needs to be neutralized.

### Keep toolbar actions authoritative for `Actions` and `Users`

The route still needs fast access to both `Actions` and `Users`, but they should not share the same inline rail anymore:

- `Actions` remains the only persistent right-side rail and must own a full-height scroll surface.
- `Users` opens from the page-toolbar into a dedicated management dialog that follows the same broad shell law as other management surfaces.

The toolbar therefore owns the operator affordances:

- `Actions` is the stateful current-detail toggle. It keeps the page focused on the live action rail, closes the users dialog if it is open, and opens the compact right sheet when the drawer is collapsed.
- `Users` opens the management dialog without introducing a second local tab strip inside the rail.

These two controls are intentionally not the same primitive:

- `Actions` uses toggle semantics because it represents the current persistent detail context.
- `Users` stays a plain button because it launches a separate dialog surface instead of becoming the current detail rail.

Alternative considered:

- Keep the internal `Tabs.List` and duplicate the same controls in the toolbar: rejected because it creates two competing control planes for one page and keeps seat management trapped inside a column that is already reserved for live action facts.

### Extract a shared actor selector primitive

The repository already has multiple avatar-bearing actor selectors, but they were implemented ad hoc:

- message room viewer chooser in the page-toolbar
- terminal `Call tool as`
- terminal `Grant actor`

These surfaces all share the same durable contract:

- selected trigger shows avatar + nickname
- dropdown items show avatar + nickname
- a second line may render a durable subtitle such as address, actor id, or access context

The new shared actor selector primitive should own this markup and styling so feature code only passes actor facts. Features may still decide what the second line means, but they should stop rebuilding the select shell.

The primitive also needs independent trigger/menu subtitle control:

- compact terminal triggers show only avatar + nickname
- dropdown options may still show avatar + nickname + address/actor id
- bordered versus borderless chrome stays orthogonal to the subtitle decision

### Keep `HelpHint` as the only explanatory copy path and make the primitive overlay-safe

The toolbar should not reclaim a static subtitle row just to explain what the route does. Explanatory copy belongs in `HelpHint`, but once the terminal page moved to a compact shell, the help popup could sit underneath sidebar chrome because the primitive host created a low z-index stacking context.

The fix belongs in the shared primitive, not in the terminal page:

- `HelpHint` keeps owning the popup trigger and popup positioning contract.
- the host raises its stacking level while open so the popup can float above compact shell chrome.
- terminal-specific copy stays short enough to fit mobile widths without turning the help popup into a second panel.

Alternative considered:

- Give the terminal route a bespoke tooltip/popover implementation: rejected because the problem is not terminal-specific behavior; it is a shared primitive overlay law.

### Reuse the Heartbeat structured invocation viewer instead of a terminal-only preview stack

Terminal action facts and Heartbeat tool facts are both durable tool invocation records. They should therefore render through one shared Svelte viewer path instead of maintaining:

- Heartbeat on the newer structured viewer stack
- terminal actions on a legacy web-component wrapper

The terminal surface now routes its action cards through the same `Tool` + structured value viewer composition used by Heartbeat. That keeps YAML/JSON previews, expansion behavior, and future viewer fixes shared.

Alternative considered:

- Keep the legacy terminal preview because it already worked: rejected because it preserves two independent renderers for the same durable fact type and guarantees visual drift.

### Keep the shared structured viewer, but force plain/static mode in the terminal rail

The terminal `Actions` rail is narrower and denser than Heartbeat. It still needs the same durable projection logic, but it does not have room for an extra viewer-mode switcher inside every card. The terminal surface therefore keeps the shared `ToolInvocationCard` path while explicitly forcing its structured values into plain/static mode for this context.

This preserves one renderer law:

- YAML / JSON / object projection stays shared with Heartbeat
- future structured-value fixes still land once
- terminal action cards stop exposing viewer-mode chrome that fights the narrow rail layout

Alternative considered:

- Fork a second "terminal compact viewer" wrapper around the same data: rejected because that would recreate the visual drift problem under a different name and reintroduce a feature-local renderer path.

### Unify write and read under one `InputGroup` composer law

The terminal page originally had a second bottom surface feeling like a footer. That violated the surface layering rule: the stage pane already owns the primary content surface, so its write/read controls must live inside the same pane instead of reviving another chrome band underneath it.

The page now treats write and read as two states of one composer family:

- both use `InputGroup.Root layout="block"`
- both keep the actor selector inside the addon row in compact, single-line form
- both keep the submit action inside the same addon row, so action affordances do not drift away from the selected actor and mode
- read mode keeps its parameter fields in the upper panel, so future read parameters extend there without polluting the bottom action row
- read mode still uses the same overall shape as write mode, with the bottom row remaining a simple `ActorSelect + Button` action grammar

Alternative considered:

- Keep write as a large composer and read as a bespoke dense toolbar row: rejected because it recreates two independent control grammars for the same bottom action area and makes future state/layout fixes twice as expensive.

## Risks / Trade-offs

- [Compact sheet fallback could hide activity behind one more click] → Keep `Actions` as a first-class toolbar affordance, and add DOM coverage that compact mode opens the shared right sheet instead of dropping the rail.
- [Desktop threshold tuning can accidentally collapse too early] → Choose explicit `leftMin/rightMin` values and verify current desktop stories at 720px and 920px widths.
- [Ratio persistence can leak across unrelated pages] → Use a terminal-specific persistence key instead of a generic shared key.
- [Toolbar actions can disappear too early on medium widths] → Keep terminal toolbar secondary data light so the `Actions` and `Users` affordances stay inline longer than status-heavy pages.
- [Shared actor selector could overfit one page] → Keep the primitive limited to avatar + label + optional subtitle; route-specific role badges or extra actions stay outside the primitive.
- [Shared help-hint layering change could overlap modal chrome] → Raise the host only while open and keep modal dialogs on their own higher portal layers.

## Acceptance Strategy

### 1. Source and Storybook contracts

- `terminal-system-surface-layout.spec.ts` must continue proving that the terminal route owns toolbar content, keeps an actions-only detail rail, and no longer revives a scaffold footer snippet.
- `terminal-system-surface.stories.ts` must keep explicit scenarios for:
  - desktop split mode versus compact right-sheet mode
  - users dialog reachability from the toolbar
  - authoritative toolbar status chips for terminal runtime facts
  - shared structured viewer rendering for terminal action facts
  - write/read `InputGroup` presence and behavior
  - compact trigger versus rich dropdown subtitle behavior in the shared actor selector
- `tool-invocation-card.svelte` must stay the single terminal + Heartbeat invocation-card implementation, with terminal choosing plain/static structured values by configuration rather than by forking another renderer.

### 2. Focused verification commands

- `pnpm --filter @agenter/webui exec vitest run src/lib/features/terminals/terminal-system-surface-layout.spec.ts src/lib/features/collaboration/actor-select-contract.spec.ts src/lib/features/messages/messages-workbench-mount-contract.spec.ts src/lib/features/terminals/terminals-workbench-layout-contract.spec.ts src/lib/features/terminals/terminal-route-contract.spec.ts`
- `pnpm --filter @agenter/webui exec vitest run --project storybook test/storybook/terminal-system-surface.stories.test.ts`
- `pnpm --filter @agenter/webui build`

### 3. Real browser walkthrough

- Run against the real `vite dev` route, not the misleading static preview shell:
  - `http://127.0.0.1:4176/terminals/chess-dev2`
- Verify both desktop and `iPhone 14` mobile.
- Confirm these observable facts:
  - stage pane border radius is `0px`
  - detail rail border radius is `0px`
  - write mode shows `terminal-write-input-group`
  - read mode shows `terminal-read-input-group`
  - terminal action cards do not expose the structured viewer mode menu in the rail

### 4. Evidence bundle

- Route- and close-up screenshots live under `.screenshot/after/terminal-surface-refine-5/`
- Review at minimum:
  - `desktop-route.png`
  - `desktop-write-input-group.png`
  - `desktop-read-input-group.png`
  - `desktop-action-card.png`
  - `mobile-write-input-group.png`
  - `mobile-read-input-group.png`
