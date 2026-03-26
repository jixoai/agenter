## Why

The WebUI long-history Chat route regressed in two visible ways during frontend verification:

1. Chat could render duplicate user and assistant rows after session hydration.
2. Long-history Chat could open around the middle of the transcript instead of the latest turns.

The root cause is that the client runtime store merges two representations of the same chat record:
- runtime snapshot rows using in-memory ids
- persisted history rows using database ids

The current merge logic only deduplicates by `id`, so semantically identical records survive side-by-side.

## What Changes

- Teach the client runtime store to collapse semantically identical runtime-snapshot chat rows when the persisted history version arrives.
- Prefer persisted chat records over in-memory runtime copies for the same message.
- Refresh the WebUI E2E contract so mobile navigation assertions match the current tab-based shell and long-history attachment assertions follow the actual scroll path.

## Impact

- Chat opens on the latest persisted turns again.
- Transcript rows stop duplicating during hydration.
- Desktop and mobile browser verification reflect the current shell contract.
