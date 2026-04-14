## Why

The current Heartbeat row presentation still treats durable runtime `message-parts` like ordinary chat bubbles. That causes user-scoped rows to inherit `bg-primary` chat styling, duplicates low-signal metadata chips, exposes raw `Text` part labels, and makes structured payload content hard to read against the chosen surface tones.

We need to correct this now because Heartbeat is an operator inspection surface, not a social chat surface. It must present durable facts with inspection-first density, factual metadata, correct avatar identity, and predictable global viewer behavior.

## What Changes

- Rebuild Heartbeat message-part rows so they use inspection-row styling instead of chat bubble skin.
- Reduce Heartbeat row metadata to the durable facts that matter in practice, removing repeated role chips, meaningless `round 0` noise, and unnecessary `Text` part labels.
- Use the active AvatarSession icon for Heartbeat row avatars instead of fallback initials like `YO`.
- Fix structured-value viewer mode behavior so global mode changes immediately update any viewer without a local override, while local overrides stay DOM-local and reset on remount.
- Record the official ai-elements-svelte LLM docs entry in the repository's durable engineering guidance.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-runtime-shell`: Heartbeat rows now render as inspection-first runtime entries with reduced metadata noise, readable content surfaces, and AvatarSession-backed avatars.
- `structured-value-preview`: global viewer mode changes now immediately update non-overridden viewers, while local overrides remain ephemeral per mounted DOM instance.

## Impact

- Affected code is concentrated in `packages/webui` runtime Heartbeat row rendering, ai-elements message usage, and structured-value viewer state.
- Durable guidance is updated in repository documentation for ai-elements-svelte LLM docs discovery.
- No backend or persistence schema changes are required.
