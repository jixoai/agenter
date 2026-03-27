## Why

WebUI currently renders many always-visible helper sentences that are useful for first-time onboarding but become long-term noise for experienced users. The product needs one reusable help disclosure contract that keeps guidance discoverable without permanently occupying layout space.

## What Changes

- Add a shared `HelpHint` UI primitive (`?`) for contextual help copy.
- Persist hint dismissal in IndexedDB using a deterministic key derived from `sha256(textContext)` (optionally namespaced by `helpId`).
- Keep hints auto-opened for first-time users; once dismissed, keep them available through hover/click.
- Replace selected persistent helper paragraphs in dialogs, settings, chat composer status, and technical inspector headers with `HelpHint`.
- Add/adjust Storybook DOM and unit coverage for the new contract.

## Capabilities

### New Capabilities
- `persistent-help-hints`: Persistent contextual help-disclosure contract for WebUI.

## Impact

- Affected code: `packages/webui/src/components/ui/help-hint*.ts*`, selected `features/*` panels, Storybook stories/tests.
- Affected dependencies: `idb-keyval` in `@agenter/webui`.
