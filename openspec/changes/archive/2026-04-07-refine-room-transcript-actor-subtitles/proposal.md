## Why

After repairing shared session actor labels, the Room transcript still leaks selector-level disambiguation detail into the primary reading surface. Message bubbles show the full workspace path under the sender name even when the sender label is already unique and human-readable.

That detail belongs in selectors, user management, and other disambiguation-heavy surfaces, not in the conversation-first transcript.

## What Changes

- Refine Message-system actor projection so transcript rows and message read disclosures only show subtitles when they are actually needed for label disambiguation.
- Keep room management and selector surfaces free to continue using richer technical subtitles.
- Add focused regression tests for the subtitle-visibility helper that now owns this projection law.

## Capabilities

### Modified Capabilities

- `message-system-surface`: room transcript actor presentation becomes conversation-first by hiding redundant technical subtitles unless duplicate labels require them.

## Impact

- `packages/webui/src/lib/features/messages`
- `openspec/specs/message-system-surface/spec.md`
