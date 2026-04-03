## Context

The active Svelte WebUI is functionally ahead of the archived React package, but the migration drifted in three coupled ways:

1. `@agenter/web-chat-view` still renders the shared chat surface through hand-built layout and local CSS instead of a durable Svelte UI composition model.
2. `message-system` no longer centers the operator on the room transcript workflow; it mixes room browsing, transcript reading, and room administration in one stretched route shell.
3. `packages/webui` feature code started compensating for these shell mismatches with multipart alias APIs and layout patch classes such as compensating `py-0`, redundant `min-h-0`, and ad hoc nested scroll wrappers.

The user explicitly wants correctness over stylistic preference: correct component choice, official multipart composition, `flex` for one-dimensional layout, `grid` for two-dimensional layout, and responsive information architecture that progressively reveals `right-sidebar`, `left-sidebar`, `bottom-sheet`, `Dialog`, and `tabs` as space allows.

## Goals / Non-Goals

**Goals:**

- Restore `web-chat-view` as a durable shared conversation surface with transcript-first structure, `ScrollView` ownership, and better default affordances.
- Rebuild `message-system` around one clear operator story: pick room, inspect transcript, send as one actor, and open room management in a dedicated responsive surface.
- Remove fake React-style shadcn usage from the Svelte WebUI and make official multipart composition the only supported path for `Card`, `Tabs`, and similar primitives.
- Replace layout patch stacks with explicit shell ownership so panel sizing and scrolling follow durable `grid`/`flex` structure instead of compensation classes.
- Add source-contract verification to catch regressions early.

**Non-Goals:**

- Reintroducing workspace/session coupling into `message-system`, `terminal-system`, or `task-system`
- Redesigning backend transport contracts for rooms or terminals
- Creating a second UI component library parallel to shadcn-svelte for generic controls

## Decisions

### 1. Keep `web-chat-view` package-orthogonal, but refactor its surface contract

`@agenter/web-chat-view` will remain independent from `@agenter/webui`; it will not import WebUI-local components. The package will keep the same room transport contract and custom-element export, but its root, rows, and composer will be refactored into a clearer conversation shell with explicit transcript/body/action regions and shared `ScrollView` ownership.

Why this over importing `@agenter/webui` components:

- It preserves package orthogonality and avoids circular UI coupling.
- It keeps the reusable custom element contract intact.
- It allows the operator WebUI and other hosts to reuse one room transport surface without inheriting the entire WebUI package.

### 2. Move room administration back into a dedicated management surface

`message-system` will keep room browsing and transcript reading as the route’s primary task. Room users, grants, metadata editing, archive, and dissolve actions will live in a dedicated room-management dialog that uses sidebar/tabs internally. Desktop can expose richer secondary sections by default, but compact view must preserve the transcript as the dominant surface.

Why this over a permanently expanded inline admin rail:

- The main operator workflow is reading/sending messages, not continuously editing room metadata.
- Inline administration was consuming route width, compressing the transcript, and encouraging extra layout compensation.
- Dialog/sidebar composition maps directly onto the user’s responsive information architecture guidance.

### 3. Remove alias-style multipart exports for shadcn-svelte primitives

The WebUI component layer will stop encouraging `Card`, `CardHeader`, `Tabs`, `TabsList`, and similar alias imports. Feature code must use official multipart composition such as `* as Card` with `Card.Root/Header/Content/...` and `* as Tabs` with `Tabs.Root/List/Trigger/Content`.

Why this over preserving aliases:

- The aliases make Svelte code look like React-specific shadcn usage and hide the real multipart boundary.
- They encourage route code to treat multipart primitives like monolithic components.
- Removing the aliases gives us one canonical composition style across generated and hand-written code.

### 4. Introduce panel shells instead of compensating card defaults in feature code

Where route panels need fixed headers plus scrollable bodies, feature code will use explicit panel shell structure instead of overriding generic card padding and gap defaults in-place. That can be achieved with a small composite shell primitive or with direct `div`/`Card.Root` structure, but in either case the shell must own:

- one explicit `grid` or `flex` layout contract
- one primary `ScrollView` owner
- semantic padding and border ownership without compensating `py-0/p-0/min-h-0` stacks

Why this over patching generic `Card.Root` everywhere:

- The current patch style is a symptom that the container is not carrying the right semantics.
- The user explicitly does not want compensation classes to substitute for correct layout modeling.
- Panel shells are easier to audit for scroll ownership and responsive collapse.

### 5. Enforce the layout contract with source-level tests

The WebUI contract tests will be extended to flag:

- feature-layer `min-h-0`
- feature-layer multipart alias imports/usages for shadcn-svelte primitives
- continued raw scroll ownership where `ScrollView` should own scrolling

Why this over relying on code review:

- The regression already spread across multiple routes.
- These are structural, low-level rules that can be checked mechanically.

## Risks / Trade-offs

- [Reusable custom element styling vs shadcn-svelte ergonomics] → Keep the transport package orthogonal and self-contained, but refactor the surface structure so the WebUI can wrap it cleanly without reintroducing duplicated chrome.
- [Removing alias exports can touch many files] → Update imports and usage in one sweep, then keep source-contract checks to prevent partial rollback.
- [Panel shell cleanup can surface latent scroll bugs] → Refactor one primary scroll owner per route and validate `Messages`, `Terminals`, `Workspaces`, `History`, `Settings`, and runtime detail with unit/DOM and targeted browser verification.
- [Responsive management surfaces can increase route complexity] → Centralize room management in one dialog/sidebar model instead of duplicating desktop and compact admin UIs.

## Migration Plan

1. Create and commit the spec artifacts for the refactor.
2. Refactor WebUI primitive exports and feature imports to the canonical multipart style.
3. Rework `message-system` and `web-chat-view` shells around explicit primary/secondary surfaces and `ScrollView` ownership.
4. Clean remaining route panel layouts that still depend on patch classes introduced during the migration.
5. Add/update source-contract, DOM, and targeted browser verification before archiving the change.

Rollback is straightforward because the change is UI-structure only: revert the implementation commit(s) and restore the previous route/component composition if a regression is discovered during verification.

## Open Questions

- None currently. The user already chose the architectural direction: correctness, official component composition, and responsive secondary surfaces over preserving the current patch-based layout.
