## 1. OpenSpec And Contracts

- [ ] 1.1 Add change artifacts for provider-owned system prompt contributors and compact ready-reply provenance.
- [ ] 1.2 Sync the affected main specs so the platform law is visible outside the change folder.

## 2. Runtime Implementation

- [ ] 2.1 Extend `AgentToolProvider` and `AgenterAI` so active providers can contribute `SYSTEMS_GUIDE` prompt sections with legacy-template fallback.
- [ ] 2.2 Make the session runtime's `message`, `terminal`, and `task` providers publish their own multilingual prompt sections.
- [ ] 2.3 Fix compact ready-reply derivation so each dispatched reply keeps its own channel-local trigger provenance.

## 3. Verification

- [ ] 3.1 Add unit coverage for provider-owned prompt injection and legacy-template fallback.
- [ ] 3.2 Add a compact regression that proves two different replies in the same channel keep separate trigger phrases.
- [ ] 3.3 Run targeted app-server tests plus real-AI regression scenarios for terminal-backed fact gathering and message-system role behavior.
