## Why

The first real-provider validation now proves a single user and one Avatar can complete a room-to-terminal-to-URL delivery loop. What remains unverified is the next app promise: multiple Avatars collaborating inside one project room, exchanging implementation details through shared room truth, consuming room attachments, and delivering a final result back to the user.

This matters now because the system’s differentiation is not just “one Avatar can code”, but “multiple Avatars can coordinate like a small engineering team”. Without a repeatable real-provider scenario for that behavior, the backend still lacks a direct acceptance test for shared-room collaboration, attachment handoff, and multi-runtime convergence.

The first full real run also exposed a validation-law gap: the frontend can speculate about the backend API contract before the backend publishes the final answer, and the scenario currently tolerates that false fact long enough to pollute the shared room truth. That violates the single-source-of-truth rule for project-room coordination and makes the real run flaky even when the runtime and mounts are correct.

## What Changes

- Add a backend-only real-provider validation scenario for one user, two Avatars, and one shared project room.
- Reuse the existing real harness and global room control-plane to create a project room that includes the user plus two Avatar sessions as room participants.
- Simulate a simple frontend/backend split: one Avatar handles backend implementation, one Avatar handles frontend implementation plus a design attachment posted into the room.
- Enforce a single shared-room API contract authority so the frontend asks for the backend contract without inventing it and the backend must publish the final room truth before implementation proceeds.
- Verify that interface negotiation and integration discussion happen through the shared room instead of hidden side channels, and that the user can perform a final acceptance pass after both Avatars finish.
- Keep the scenario intentionally small so the test validates collaboration mechanics, not large application complexity.

## Capabilities

### New Capabilities
- `real-ai-project-room-collaboration-validation`: executable real-provider acceptance scenarios that validate shared project-room collaboration, room attachment delivery, cross-avatar coordination, and final user acceptance.

### Modified Capabilities
- None.

## Impact

- Affected systems: `packages/app-server` real harnesses, room/attachment orchestration helpers, and real integration tests.
- Affected APIs: no new public API is required if current global room, grant, focus, asset upload, and session runtime contracts are sufficient.
- Affected operations: real-provider test runs require at least two runnable Avatar sessions plus one shared global room with durable grants and room asset upload support.
