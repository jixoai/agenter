## Why

The current Chat composer still mixes actions, help copy, and status into one visually noisy block, while the workspace header repeats passive state, full paths, and route-local actions in a way that wastes the first viewport on compact screens. We need a tighter, more componentized layout contract plus a durable prompt/rubric so future AI- or engineer-driven UI changes do not regress back into redundant chrome and padding-heavy shells.

## What Changes

- Split the Chat composer into two explicit rows: a single-line action bar and a smaller status/help bar.
- Keep secondary composer actions adaptive: show text when space allows, collapse to icon-only when space is tight, and collapse help into a `?` rich tooltip before degrading actions.
- Compress the workspace shell header into a passive top surface that favors icon signals and tooltips over repeated status text and long paths.
- Move session controls out of the top header and into a route-local status pill menu on the first screen of Chat/Devtools/Settings.
- Tighten WebUI padding and surface ownership so compact viewports do not stack unnecessary outer/inner spacing.
- Add a repository-level WebUI layout prompt/rubric plus Storybook/browser evidence outputs that humans or AI can use to review density, hierarchy, and compact layout quality.
- Make Storybook verification component-first: primitive stories/tests must pass before composite and route assembly stories are used to validate page wiring.

## Capabilities

### New Capabilities
- `webui-layout-review-rubric`: Define the prompt, rubric, and evidence contract used to review WebUI shell/page density and layout quality.

### Modified Capabilities
- `chatapp-surface`: Change the composer contract to use explicit action/status rows with adaptive affordances and lower default height.
- `chat-surface-presentation`: Move the primary session action into a compact route-local status pill and reduce redundant visible status copy in Chat.
- `webui-chat-navigation`: Keep the top header passive and compact, show only workspace basename by default, and stop injecting route-local session actions into header chrome.
- `overflow-layout-contract`: Tighten compact padding ownership so shell, route, and composer surfaces do not stack redundant spacing.

## Impact

- Affected code: `packages/webui` shell, chat, Storybook DOM tests, and new review/rubric docs.
- Affected workflow: Chat/Shell layout work must now land with primitive-first Storybook coverage before page assembly changes.
- Affected interfaces: `TopHeader`, `WorkspaceShellFrame`, composer toolbar props, and layout audit utilities used by stories/tests.
- No backend/API protocol changes.
