## Why

Managed-seat invitation handshake is archived and the AI-facing `terminal-manage` / `message-manage` atoms already exist, but the system still lacks a durable validation law for how these capabilities should be exercised in real collaboration. Without that law, future tests and prompt guidance will drift toward brittle command scripts that overfit today's CLI wording instead of proving the actual seat, room, and terminal contracts.

## What Changes

- Add a managed-seat scenario-catalog capability for real-AI and backend validation.
- Define a scenario shape centered on `setup`, `objective`, `invariants`, `success`, and failure evidence instead of fixed command transcripts.
- Require managed-seat validation to cover realistic collaboration archetypes such as pair debugging, temporary takeover, teaching walkthrough, room-routed invitation delivery, unilateral config, revoke or expiry invalidation, management-capable handoff, and cross-instance collaboration.
- Require validation evidence to stay grounded in durable room, seat, descriptor, terminal, and process facts so failures remain diagnosable without judging exact assistant wording.

## Capabilities

### New Capabilities
- `real-ai-managed-seat-validation`: Realistic managed-seat scenario catalog and validation law for room-routed and cross-instance collaboration without command-prescriptive prompts.

### Modified Capabilities
None.

## Impact

- Affected specs:
  - `openspec/specs/real-ai-managed-seat-validation`
- Expected implementation areas:
  - `packages/app-server/test`
  - future real-provider validation harnesses and scenario fixtures
- Affected system contracts:
  - real-AI validation guidance for managed-seat collaboration
  - evidence collection for invite, accept, config, revoke, and expiry flows
