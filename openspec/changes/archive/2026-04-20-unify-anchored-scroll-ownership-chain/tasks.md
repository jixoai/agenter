## 1. Runtime Ownership Law

- [x] 1.1 Refactor the anchored virtual list scroll controller so one terminal writer owns browser scroll execution for each viewport.
- [x] 1.2 Introduce the transaction ownership-chain / middleware composition model and move append/prepend preserve logic into shared transaction programs.
- [x] 1.3 Replace render-layer and host-layer direct viewport writes with transaction facts and shared plans, including insert-motion measurement handoff.

## 2. Consumer Migration

- [x] 2.1 Migrate `bottom-anchored-timeline.svelte` to publish mutation and insert-motion facts without writing the viewport directly.
- [x] 2.2 Migrate `@agenter/web-chat-view` transcript scrolling to the unified ownership-chain runtime and delete package-local preserve/reveal writers.
- [x] 2.3 Migrate `VirtualConversation` and `Heartbeat` to the same runtime so latest follow and older reveal no longer use legacy scroll control paths.

## 3. Regression Proof

- [x] 3.1 Add shared unit coverage for ownership delegation, supersession, and the guarantee that one transaction resolves through one terminal writer.
- [x] 3.2 Add Storybook DOM contracts that reproduce the append race and prove the runtime no longer lands on stale intermediate rows.
- [x] 3.3 Expand the Storybook capability lab so append latest, prepend older, and insert motion remain manually inspectable under the new ownership law.
- [x] 3.4 Extend the Storybook capability lab with wheel, keyboard, and touch interruption contracts for explicit seek, append-follow, and prepend-reveal flows.
- [x] 3.5 Add a consumer-level WebChat Storybook DOM contract that interrupts return-to-latest with user wheel input and proves the transcript stays under user ownership.
