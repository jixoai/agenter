# User Review Loop: Connection Sheet And Header Chrome

## User Findings

- Connection should behave like a login gate: use a push modal Sheet and do not allow closing while the app is not connected.
- The home page after connecting should be Avatars only. Connection UI belongs behind the top-right configuration action, and the extra `Catalog connected` status was unnecessary.
- PageHeader and SheetHeader actions should prefer icon-only buttons rather than text buttons.
- Heartbeat detail had a double-header effect. The extra identity header under the PageHeader should be folded into the PageHeader, and footer/status chrome should remain the single bottom status area.

## Corrections

- Added `HeartbeatConnectionSheet` as a Framework7 `Sheet` with direct `Toolbar` and `PageContent` children. The Sheet opens by default and reopens if closed before a successful connection.
- Moved endpoint, mode, token, and reconnect controls out of the Avatars page and into the Connection Sheet.
- Simplified the Avatars page to a clean Avatar directory plus an icon-only top-right connection/settings action.
- Replaced text header buttons with icon-only Framework7 `Link` actions for connection settings and Heartbeat refresh. The Heartbeat back control uses Framework7's icon back link without text.
- Moved Avatar identity into the Heartbeat PageHeader and removed the extra content identity block, eliminating the detail double-header.

## Browser Evidence

- Mandatory no-connection Sheet: `.screenshot/web-heartbeat-view/mobile-connection-required-final.png`
- Connected Avatars home: `.screenshot/web-heartbeat-view/mobile-directory-final.png`
- Connection settings Sheet: `.screenshot/web-heartbeat-view/mobile-connection-sheet-final.png`
- Heartbeat detail without double header: `.screenshot/web-heartbeat-view/mobile-heartbeat-final.png`

## Iteration 3 User Findings

- Connection close should follow Sheet standard practice more closely.
- Connection Sheet height was too low; the small form should fit without an internal scrollbar.
- Connection needs an explicit connecting state, then a connected success animation before the Sheet closes.
- Connection supports a `silentConnect` parameter: when enabled and connection config exists, the frontend service connects in the background and only opens the Sheet on failure.
- Connect button should use Rounded Fill Button styling.

## Iteration 3 Corrections

- Changed Connection lifecycle into the example state service. Components no longer start the connection from `onMount`; they only render service state or request an explicit visible reconnect.
- Added `silentConnect=true` launch/query support on root and direct Heartbeat routes. Silent success keeps the Sheet closed; silent failure opens the mandatory Sheet.
- Added `editing | connecting | success | failed` connection phases, disabled form editing during connect/success, and kept the success state visible briefly before closing.
- Updated the Sheet chrome to direct `Toolbar` + title + Framework7 icon `Link sheetClose` when connected. The close action is absent before connection, so the login-gate Sheet cannot be dismissed.
- Set the Sheet to auto height with a viewport cap and made the Connect control a Framework7 rounded fill-styled button.

## Iteration 3 Evidence

- `bun run --filter '@agenter/web-heartbeat-view-example' typecheck`: pass, 0 errors, 0 warnings
- `bun run --filter '@agenter/web-heartbeat-view-example' test`: pass, 1 file / 8 tests
- Mobile Connection Sheet: `.screenshot/web-heartbeat-view/mobile-connection-sheet-final.png`
- Mobile connection success state: `.screenshot/web-heartbeat-view/mobile-connection-success-final.png`
- Mobile silent-connected directory: `.screenshot/web-heartbeat-view/mobile-directory-final.png`
