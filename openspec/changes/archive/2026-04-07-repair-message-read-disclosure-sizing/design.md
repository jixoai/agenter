## Context

`message-read-indicator.svelte` asks for `w-[min(17rem,calc(100vw-1rem))]`, while `ui/popover/popover-content.svelte` also applies `w-[min(22rem,calc(100vw-2rem))]`. In the running package, those arbitrary width utilities do not survive as durable sizing rules, so the rendered disclosure falls back to content width.

The result is observable in browser review:

- desktop: the disclosure is much narrower than the intended compact card
- mobile (`iPhone 14`): the disclosure renders as a tiny strip even though the DOM node exists and is visible

## Decision

Treat overlay width as a primitive contract:

- `ui/popover/popover-content.svelte` exposes CSS-variable-driven inline/max-inline sizing that always survives the package build
- feature consumers can override the default width through that shared variable without re-implementing popover layout
- `message-read-indicator.svelte` passes a dedicated readable width for the read disclosure and keeps compact single-column behavior

## Verification

- Focused `@agenter/web-chat-view` contract coverage for the popover sizing hook and read-disclosure width usage
- `pnpm --filter @agenter/web-chat-view exec vitest run ...`
- `pnpm --filter @agenter/web-chat-view typecheck`
- Browser verification on desktop and `iPhone 14`
