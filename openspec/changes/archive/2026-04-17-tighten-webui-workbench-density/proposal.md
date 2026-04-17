## Why

The shared workbench chrome and split-detail law are now in place, but key WebUI routes still spend too much density budget on low-value framing. `Workspaces` wastes mobile-first space in its start/detail shells, and `Messages` still carries a brittle compact toolbar contract at the iPhone 14 baseline.

## What Changes

- Tighten the `Workspaces` start page so the chooser stays list-first, the detail summary stays factual, and mobile viewports expose more immediately usable content.
- Tighten the `Workspaces` detail route so the shared content header, main tree/catalog stage, bottom-area actions, and right detail drawer use less vertical slack while keeping the existing split-detail law unchanged.
- Refine the shared workspace content header so `View as` and workspace identity remain intact on desktop and mobile without expanding into a detached oversized card.
- Fix the compact `Messages` room toolbar so the `View as` trigger, room actions, and `chat/assets` mode chips remain fully visible and stable inside the fixed 48px toolbar at the 390px mobile baseline.
- Tighten the shared room composer so mobile and desktop keep the transcript dominant, the send action stays inline with its action rail at the 390px baseline, and passive hint chrome no longer expands into a second fake-card band.
- Add or update Storybook DOM / contract coverage for the revised `Workspaces` density behavior and the `Messages` compact toolbar contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-system-workbench`: tighten the durable density contract for the workspace start page, shared content header, explorer/rules/private stage composition, and compact detail presentation.
- `message-system-surface`: tighten the compact room-toolbar contract so viewer identity, room actions, and body-mode chips stay visible inside the fixed toolbar band on mobile, while the shared composer stays lightweight and transcript-first.

## Impact

- `packages/webui/src/lib/features/workspaces/*`
- `packages/webui/src/lib/features/messages/*`
- `packages/web-chat-view/src/composer/*`
- `packages/web-chat-view/src/default-composer.svelte`
- `packages/webui/test/storybook/*`
- `openspec/specs/workspace-system-workbench/spec.md`
- `openspec/specs/message-system-surface/spec.md`
