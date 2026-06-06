# User Review: Framework7 Offset, FAB, And Markdown Rendering

## User Feedback

- If official `PageContent + Toolbar` is used, investigate why `--f7-page-toolbar-bottom-offset` was not injected automatically.
- Move scroll-to-bottom from the top chrome to an official Framework7 FAB that appears according to scroll state.
- Fix Heartbeat cards that rendered both raw markdown text and HTML preview.

## Investigation

- Framework7 v9 toolbar offset is driven by CSS, not JavaScript injection.
- The official toolbar stylesheet applies `--f7-page-toolbar-bottom-offset` with the sibling rule `.toolbar-bottom ~ *`.
- Therefore `Toolbar position="bottom"` must be a direct `Page` child before `PageContent`; if it is placed after `PageContent`, the selector cannot affect the content node.
- Framework7 FAB is also a direct `Page` overlay primitive; the detail page should keep `Navbar -> Toolbar(bottom) -> PageContent -> Fab` ordering.
- The markdown double display came from the Heartbeat entry compact summary being rendered before the markdown preview body. The markdown element itself was already in `mode="preview"`.

## Implementation

- Kept the bottom actions in the official Framework7 `Toolbar` and placed that toolbar before `PageContent` in both the package `HeartbeatPage` shell and the example Heartbeat route.
- Added `HeartbeatScrollFab`, using official Framework7 `Fab position="right-bottom"`, with visibility driven by `PageContent` scroll state.
- Removed the compact-mode raw summary before the markdown body and retained summary only as a no-block fallback.
- Updated DOM tests to read markdown preview text from open Shadow DOM instead of reintroducing raw text into the light DOM.

## Evidence

- Official source: `framework7/components/toolbar/toolbar.less` lines 162-168 show `.toolbar-bottom ~ *` setting `--f7-page-toolbar-bottom-offset`.
- Official source: `framework7-svelte/components/toolbar.svelte` lines 47-52 show `position="bottom"` creates `toolbar-bottom`.
- Official source: `framework7-svelte/components/page-content.svelte` lines 125-132 show `PageContent` renders the `.page-content` node that receives the offset variable.
- Agent-browser mobile metric: `toolbarBeforePageContent=true`, `offsetVar=64px`, `paddingBottom=64px`, `overflowY=auto`, `scrollWidth/clientWidth=390/390`.
- Agent-browser mobile FAB metric before click: `.ag-heartbeat-scroll-fab.fab.fab-right-bottom` existed with text `Scroll to bottom`.
- Agent-browser mobile FAB metric after click: `scrollTop=maxScrollTop=11749`, `PageContent overflowY=auto`, stream `overflowY=visible`, and FAB disappeared.
- Agent-browser markdown metric: all markdown hosts were `data-mode="preview"`, raw markdown body count was `0`, rendered marker body count was `0`, and rendered marker shadow count was `1`.
- Screenshots:
  - `.screenshot/web-heartbeat-view/agent-mobile-f7-offset-fab-before.png`
  - `.screenshot/web-heartbeat-view/agent-mobile-f7-offset-fab-after-bottom.png`
  - `.screenshot/web-heartbeat-view/agent-mobile-f7-config-sheet-offset-pass.png`
