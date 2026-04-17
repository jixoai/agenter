## 1. Shared ai-elements Context adoption

- [x] 1.1 Replace the local dropdown-driven Context widget with shared ai-elements context state, trigger, content, icon, progress, and token-row primitives
- [x] 1.2 Publish the supporting HoverCard / Progress / variant / public-type helpers needed by the new Context composition
- [x] 1.3 Update Heartbeat footer rendering to consume the shared Context primitive and reset to unavailable after compact

## 2. Bottom-anchor virtualization law

- [x] 2.1 Extend `ScrollView` with virtual-size and item-size-adjust hooks needed by bottom-anchored consumers
- [x] 2.2 Update `VirtualConversation` and stick-to-bottom context so appended or growing latest rows keep the viewport anchored
- [x] 2.3 Keep the Heartbeat stage shrinkable so the inner conversation viewport remains the only scroll owner

## 3. Verification

- [x] 3.1 Add or update tests for compact-reset footer context and the shrinkable Heartbeat stage layout contract
- [x] 3.2 Run targeted WebUI/Svelte tests covering the new primitives and selectors
- [ ] 3.3 Sync affected durable specs before archiving
