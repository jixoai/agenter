## Why

The Svelte `Terminals` route currently renders a simplified global terminal page that relies on polling and loses state after refresh. Operators need a live collaborative terminal surface with immediate activity, seat, and approval updates.

## What Changes

- Replace terminal polling loops with terminal-system live subscriptions for terminal catalog, status, snapshots, activity, grants, approvals, and focus.
- Rebuild the Svelte `Terminals` route so `Actions + Users` behaves like a true operator sidebar instead of a static detail panel.
- Keep `terminal-view` as the independent renderer while making the surrounding operator surface fully live and refresh-safe.
- Expand BDD coverage so the full operator terminal story is exercised on desktop and mobile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `terminal-system-surface`: the terminal-system route must reflect terminal activity and seat changes live and preserve durable state after refresh
- `client-runtime-store`: global terminal slices must stay normalized as subscription-backed store state instead of route-local polling state

## Impact

- `packages/app-server` terminal live event subscriptions
- `packages/client-sdk` terminal catalog/activity/grant/approval store slices
- `packages/webui` `Terminals` route, access dialogs, and action rendering
- Playwright and Storybook BDD coverage for terminal collaboration flows
