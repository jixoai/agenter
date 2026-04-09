## 1. OpenSpec And Harness Setup

- [x] 1.1 Finalize the proposal, design, and spec for the single-avatar real AI room delivery scenario.
- [x] 1.2 Extend the real scenario helpers with deterministic tiny-app delivery markers, URL parsing, and HTTP polling utilities.

## 2. Real Scenario Implementation

- [x] 2.1 Implement a backend-only real-provider scenario that asks one Avatar to create a tiny app, launch it through terminal tools, and deliver the URL in the primary room.
- [x] 2.2 Implement the simulated user feedback round and assert that the delivered app updates on the same URL with deterministic v2 markers.
- [x] 2.3 Add failure diagnostics that dump room truth, recent model calls, and latest delivery evidence when the scenario fails.

## 3. Verification

- [x] 3.1 Add an opt-in real integration test or script entry for the single-avatar delivery scenario.
- [x] 3.2 Run the scenario against a real configured provider and record the result in the change.

Verification record:
- 2026-04-09: `AGENTER_RUN_REAL_LOOPBUS=1 bun test packages/app-server/test/real-room-terminal.integration.test.ts` passed in 152.74s against resolved real provider `anthropic/glm-5.1`.
