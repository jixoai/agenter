# Self Review: add-web-heartbeat-view

## Scope

This apply implements the first standalone `@agenter/web-heartbeat-view` slice:

- package-owned Heartbeat parser/materialization/rendering
- host-neutral `HeartbeatView` and Framework7-compatible `HeartbeatPage`
- `readonly | configable` statusbar action mode
- standalone Framework7 example with Avatar directory and Heartbeat route
- existing client-sdk connection path with `createSession({ autoStart:false })`
- no backend endpoint changes
- no Studio migration

## Result

Pass for first-phase example acceptance. Studio migration remains explicitly deferred until the example is accepted by the user.

## Verification

- `bun run --filter '@agenter/web-heartbeat-view' typecheck`: pass, 0 errors, 0 warnings
- `bun run --filter '@agenter/web-heartbeat-view' test`: pass, 4 unit files / 16 tests, 1 Storybook browser test, 1 DOM browser file / 8 tests
- `bun run --filter '@agenter/web-heartbeat-view-example' typecheck`: pass, 0 errors, 0 warnings
- `bun run --filter '@agenter/web-heartbeat-view-example' test`: pass, 1 file / 11 tests
- `bun run openspec:vision -- validate add-web-heartbeat-view`: pass
- `bun run openspec:vision -- check add-web-heartbeat-view`: pass
- Static package/example source scan for `@ts-nocheck`, `as any`, `: any`, and Studio imports: pass, no matches
- `git diff --check`: pass

## Browser Evidence

- Mobile directory: `.screenshot/web-heartbeat-view/mobile-directory-heartbeat-fix.png`
- Mobile mandatory connection Sheet: `.screenshot/web-heartbeat-view/mobile-connection-required-final.png`
- Mobile connection settings Sheet: `.screenshot/web-heartbeat-view/mobile-connection-sheet-final.png`
- Mobile connection success state: `.screenshot/web-heartbeat-view/mobile-connection-success-final.png`
- Mobile readonly Heartbeat: `.screenshot/web-heartbeat-view/mobile-heartbeat-final.png`
- Mobile configable Heartbeat: `.screenshot/web-heartbeat-view/mobile-configable-final.png`
- Mobile Heartbeat status/scroll/toolbar fix: `.screenshot/web-heartbeat-view/mobile-heartbeat-toolbar-fix.png`
- Mobile Heartbeat polish after agent-browser: `.screenshot/web-heartbeat-view/agent-mobile-heartbeat-after-polish-clean.png`
- Mobile Framework7 final main state: `.screenshot/web-heartbeat-view/agent-mobile-f7-final-main.png`
- Mobile Framework7 config Sheet: `.screenshot/web-heartbeat-view/agent-mobile-f7-config-sheet-final.png`
- Mobile Framework7 compact confirm Dialog: `.screenshot/web-heartbeat-view/agent-mobile-f7-compact-confirm-final.png`
- Mobile Framework7 toolbar offset and FAB before scroll: `.screenshot/web-heartbeat-view/agent-mobile-f7-offset-fab-before.png`
- Mobile Framework7 FAB after scroll-to-bottom: `.screenshot/web-heartbeat-view/agent-mobile-f7-offset-fab-after-bottom.png`
- Mobile Framework7 config Sheet after offset/FAB pass: `.screenshot/web-heartbeat-view/agent-mobile-f7-config-sheet-offset-pass.png`
- Mobile configable sheet: `.screenshot/web-heartbeat-view/mobile-config-sheet-final.png`
- Mobile context usage Sheet: `.screenshot/web-heartbeat-view/agent-mobile-context-usage-sheet-final.png`
- Mobile context usage style/list polish Sheet: `.screenshot/web-heartbeat-view/agent-mobile-context-usage-style-list-final.png`
- Mobile context usage official Progressbar/ListButton Sheet: `.screenshot/web-heartbeat-view/agent-mobile-context-usage-progressbar-listbutton-final.png`
- Desktop directory: `.screenshot/web-heartbeat-view/desktop-directory-final.png`
- Desktop Heartbeat: `.screenshot/web-heartbeat-view/desktop-heartbeat-toolbar-fix.png`

The connected local daemon returned four Avatars. The default Avatar was running and returned two grouped Heartbeat rows. The Avatars directory showed `Running` for default and `Stopped` for the other Avatars. The Heartbeat detail rendered status in the Framework7 `Subnavbar`, bottom actions in `Toolbar toolbar-bottom`, and let Framework7 `PageContent` own the scroll (`overflowY: auto`, `scrollHeight > clientHeight`) while the stream stayed normal flow (`overflowY: visible`).

The mobile polish pass removed the detail-page horizontal overflow (`PageContent scrollWidth/clientWidth = 390/390`), added a `Scroll to bottom` control that reaches the PageContent maximum scroll offset, and added configable runtime Start/Stop controls through existing client-sdk lifecycle methods. The bottom actions now use official Framework7 `Toolbar` + icon-only `Link` controls, the config editor is an official Framework7 modal `Sheet`, and Compact is guarded by an official Framework7 confirm dialog. The true Pause API remains a follow-up because no public client-sdk/router pause capability is exposed in this phase.

The Framework7 offset pass confirmed the official rule is CSS sibling-driven: `Toolbar position="bottom"` creates `.toolbar-bottom`, and `.toolbar-bottom ~ *` sets `--f7-page-toolbar-bottom-offset` on following siblings. The live mobile route now keeps `Toolbar` before `PageContent`; agent-browser measured `offsetVar=64px`, `paddingBottom=64px`, `overflowY=auto`, and `scrollWidth/clientWidth=390/390`. Scroll-to-bottom moved to official `Fab position="right-bottom"` and reached `scrollTop=maxScrollTop=11749` before the FAB disappeared. Markdown cards no longer double-render raw markdown and preview; raw markdown count in the light DOM was `0`, while preview content remained inside `agenter-markdown-document` Shadow DOM.

The acceptance polish pass hid row layout switches where compact/detailed output is equivalent, replaced visible tool state text with colored state icons, changed the bottom Compact action to an archive icon, restored config Sheet entrance by mounting closed before opening, rebuilt the config form with Framework7 list rows and Toggle, and moved user-role avatars to the right. Agent-browser mobile metrics: `toolStateTexts=[]`, `layoutToggleCount=3`, `entriesWithoutToggle=4`, user avatar `gridColumnStart=2`, config Sheet `immediate=null -> modal-in`, `hasToggle=true`, `listCount=1`. Screenshot: `.screenshot/web-heartbeat-view/agent-mobile-acceptance-polish-config-sheet.png`.

The context usage polish replaced the bottom first-level Compact action with a context-usage display control and moved Compact into a context usage Modal Sheet with a `Shredder` icon and the existing official confirm dialog. Package BDD now covers `40K / 128K = 31.3%`, input/output rows, no Cost rendering, model/config summary, and subnavbar token removal. Agent-browser mobile metrics on the live example: `documentScrollWidth=390`, `pageContentScrollWidth/clientWidth=390/390`, toolbar text `0.3%`, subnavbar text `Idle · Live push active · 3 groups · 1 background`, `subnavbarHasTokenText=false`, context Sheet `modal-in`, `sheetHasCost=false`, `sheetHasCompact=true`, `sheetHasModelConfig=true`. Screenshot: `.screenshot/web-heartbeat-view/agent-mobile-context-usage-sheet-final.png`.

The context usage style/list pass balanced the bottom Framework7 Toolbar actions as two equal `Link` slots, converted the bottom ring into a muted-track progress ring using `color-mix(... oklch/oklab ...)` plus a conic progress fill, generalized the accepted `ag-heartbeat-modal-sheet*` toolbar/title/content classes across Config and Context usage sheets, and rebuilt Context usage as official Framework7 `List`/`ListItem` rows. Agent-browser mobile metrics on the live example: `documentScrollWidth=390`, `pageContentScrollWidth/clientWidth=390/390`, bottom action widths `155/155`, `actionWidthDiff=0`, context Sheet `modal-in`, `sheetListCount=2`, `sheetItemCount=6`, `sheetHasMeterBlock=false`, `sheetHasCost=false`, `sheetHasTooltip=false`, model/config visible in the Sheet, and the ring computed as `conic-gradient(oklch(...), oklab(...))`. Screenshot: `.screenshot/web-heartbeat-view/agent-mobile-context-usage-style-list-final.png`.

The official component pass replaced the Context usage Sheet's internal custom progress row with Framework7 `Progressbar` and replaced the Compact row with Framework7 `ListButton`. The bottom Toolbar ring remains the compact percentage trigger indicator from the accepted toolbar requirement. Agent-browser mobile metrics on the live example: `documentScrollWidth=390`, `pageContentScrollWidth/clientWidth=390/390`, bottom action widths `155/155`, `actionWidthDiff=0`, context Sheet `modal-in`, `sheetListCount=2`, `sheetItemCount=5`, `hasProgressbar=true`, `progressbarData=1.3984375`, `hasListButton=true`, `listButtonText=Request compact`, `sheetHasRing=false`, `sheetHasCost=false`, and `sheetHasTooltip=false`. Screenshot: `.screenshot/web-heartbeat-view/agent-mobile-context-usage-progressbar-listbutton-final.png`.

## Drift / Follow-up

- Studio still owns its current Heartbeat route. This is intentional for first phase.
- After user acceptance of `@agenter/web-heartbeat-view:example`, plan a follow-up migration where Studio imports the package through a thin adapter.
- If richer demo data is needed, seed or run an Avatar so grouped Heartbeat rows exist in the local daemon DB before acceptance review.
