## Why

Browser verification of the `New room` flow found a UI contract leak: the title field looks like it defaults to `Incident bridge`, but the field is actually empty and the created room falls back to the server default title `Room`. The create flow itself works, but the affordance lies about the resulting room title.

## What Changes

- Align the `New room` title field placeholder/help copy with the real fallback title law instead of showing a misleading example as if it were a default value.
- Add regression coverage so the create route keeps advertising the same fallback title that the control plane applies when the operator leaves the field blank.

## Capabilities

### Modified Capabilities

- `message-system-surface`: the `New room` title affordance now reflects the durable fallback title behavior instead of implying a different default title.

## Impact

- Affected code: `packages/webui`
- Affected behavior: empty-title room creation affordance and its regression coverage
