# Self Review: add-heartbeat-record-pagination

## Scope Checked

- Active change: `add-heartbeat-record-pagination`
- Package/example target: `@agenter/web-heartbeat-view` and `@agenter/web-heartbeat-view:example`
- Real example URL used for browser evidence:
  `http://127.0.0.1:4183/heartbeat/00ca43a6-c45c-5628-b398-6f0e5e1d4a7b?mode=configable&silentConnect=true&pageSize=2&wsUrl=ws%3A%2F%2F127.0.0.1%3A4580%2Ftrpc`

## Implementation Evidence

- The standalone example owns the dedicated Framework7 route `/heartbeat/:runtimeId/records/:recordId`.
- `HeartbeatView` emits `callbacks.onOpenRecordDetail` when present and only uses inline detail as package fallback.
- Compact cards no longer fall back to prototype sample ratios when before/after usage payloads are absent.
- Config changed-control cards preserve non-numeric and non-standard boolean values such as `adaptive` and `auto` instead of coercing them to `0` or `off`.
- `HeartbeatExampleState` now preserves `mode`, `silentConnect`, `wsUrl`, and non-default `pageSize` across list, detail, and Avatar-directory URLs.
- The example connection adapter forwards `recordPageSize` into `loadHeartbeatRecords` for latest and fixed anchors.
- Example BDD coverage now asserts that record-row click opens the dedicated record route and preserves `pageSize=2`.

## Command Evidence

- `bun run --cwd packages/web-heartbeat-view/example test -- --run heartbeat-example-app.test.ts` -> 13 passed.
- `bun run --cwd packages/web-heartbeat-view/example typecheck` -> 0 errors, 0 warnings.
- `bun run --filter '@agenter/web-heartbeat-view' test:unit` -> 5 files, 19 tests passed.
- `bun run --filter '@agenter/web-heartbeat-view' test:dom` -> 1 file, 13 tests passed.
- `bun test packages/client-sdk/test/runtime-store.test.ts --timeout 30000` -> 93 passed.
- `bun run openspec:vision -- validate add-heartbeat-record-pagination` -> valid.
- `bun run openspec:vision -- commit-check add-heartbeat-record-pagination --phase self-review` -> ok.

## Browser Evidence

Agent-browser DOM interaction evidence:

- Mobile `390x844` list with `pageSize=2`: 2 visible records, total 9 records, `Older` enabled, `Latest` disabled, no document/body horizontal overflow.
- Mobile row click: first record `heartbeat-record-107` clicked; URL became `/heartbeat/00ca43a6-c45c-5628-b398-6f0e5e1d4a7b/records/107?...&pageSize=2`; page `data-name` became `heartbeat-record-detail`; no inline detail remained on the list page; no horizontal overflow.
- Mobile fixed-anchor check: before Older `[107,108]`; after Older `[106,107]`; `Latest` became enabled; no horizontal overflow.
- Mobile Model Run detail record `2`: `data-kind=model_call`, 17 station chips, 17 station bodies, 16 time SVGs, 16 vertical chip links, no horizontal overflow.
- Mobile Compact detail record `61`: `data-kind=compact`, compression object present, `New Context` selected by default, `Old Context` available, no horizontal overflow.
- Mobile Config detail record `282`: `data-kind=config`, changed-config object present, `Diff Config` selected by default, `New Config` and `Old Config` available, source `data-language=diff`, no horizontal overflow.
- Desktop `1280x900` list: 2 visible records, total 9 records, no horizontal overflow.
- Desktop Model Run detail record `2`: `data-kind=model_call`, 17 station chips and bodies, no horizontal overflow.

Screenshot evidence generated through Playwright because `agent-browser screenshot` hung in this environment:

- `review/screenshots/mobile-record-list.png`
- `review/screenshots/mobile-model-detail.png`
- `review/screenshots/desktop-model-detail.png`

## Remaining Open Items

- `4.8` remains open by design: Studio migration is not authorized.
- `4.10` remains open until checkbox changes are paired with the intended commit hygiene.
- Archive tasks remain open until user acceptance and final spec sync/archive.
