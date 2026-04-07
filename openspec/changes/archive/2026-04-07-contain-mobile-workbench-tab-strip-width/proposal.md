## Why

Mobile browser walkthroughs on `Messages > Room` show that the top workbench tab strip currently widens the document to `436px` on an `iPhone 14` viewport (`390px`). The tabs are supposed to scroll inside their own chrome band, but the current layout lets the tab strip enlarge the page itself.

## What Changes

- Contain the shared workbench tab strip so horizontal overflow stays inside the tab scroller instead of expanding the document body.
- Add focused verification for the compact room workbench proving that document width stays locked to the viewport while tabs still scroll locally.

## Capabilities

### Modified Capabilities

- `svelte-webui-platform`: compact workbench chrome keeps horizontal tab overflow local to the shared tab strip and does not widen the primary document.

## Impact

- Affected code: `packages/webui`
- Affected behavior: compact workbench tabs on room/message surfaces and any other workbench using the shared tab strip
