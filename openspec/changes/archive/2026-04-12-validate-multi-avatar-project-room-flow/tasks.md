## 1. OpenSpec And Scenario Law

- [x] 1.1 Finalize the proposal, design, and spec for the shared project-room multi-avatar validation flow.
- [x] 1.2 Define the smallest deterministic product scope, actor roles, room markers, and acceptance markers for the scenario.

## 2. Harness Implementation

- [x] 2.1 Add a real multi-avatar harness that boots two Avatar sessions on one shared project workspace and creates one shared global project room.
- [x] 2.2 Add role-priming, shared room focus, and actor-aware message inspection helpers for the two Avatar runtimes.
- [x] 2.3 Add the frontend-design attachment bridge from shared workspace file to durable room attachment while preserving frontend actor identity.

## 3. Real Collaboration Scenario

- [x] 3.1 Implement the real-provider scenario covering user requirement, frontend/backend room negotiation, design attachment handoff, interface discussion, implementation, and final user acceptance.
- [x] 3.2 Add actor-aware failure diagnostics for shared room messages, per-avatar model calls, attachments, and delivered app evidence.
- [x] 3.3 Enforce the single-source-of-truth API contract law in shared-room prompts and scenario gates so speculative payloads cannot pollute the validation.

## 4. Verification

- [x] 4.1 Add an opt-in real integration test or script entry for the multi-avatar project-room scenario.
- [x] 4.2 Run the scenario against a real configured provider and record the result in the change.
