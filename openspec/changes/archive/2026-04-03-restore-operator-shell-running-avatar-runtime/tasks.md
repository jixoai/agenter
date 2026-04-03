## 1. Shell Navigation

- [x] 1.1 Restore `Running Avatars` as a secondary section in the Svelte app shell for desktop and mobile drawers
- [x] 1.2 Reintroduce running-avatar item projections from runtime store state, including avatar label, workspace context, unread signal, and runtime status

## 2. Runtime Shell

- [x] 2.1 Add the SvelteKit running-avatar detail route at `/runtime/[sessionId]/[tab]` with `Attention` as the default tab
- [x] 2.2 Restore flat runtime peer tabs plus the active `Cycles` badge and breathing state when the avatar is running
- [x] 2.3 Add room and terminal link-out affordances from the runtime shell without embedding duplicate global catalogs

## 3. Verification

- [x] 3.1 Add Storybook DOM coverage for the shell rail and runtime tabs
- [x] 3.2 Add Playwright BDD coverage for desktop and iPhone 14 navigation through `Running Avatars` into the runtime shell
