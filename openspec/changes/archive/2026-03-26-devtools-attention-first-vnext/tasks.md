## 1. Attention-first Devtools information architecture

- [x] 1.1 Replace LoopBus-first panel naming and routing with attention-first Devtools navigation for contexts, cycles, model calls, trace, terminals, and tasks.
- [x] 1.2 Build attention-native client selectors and view-models for contexts, items, cycle frames, model calls, and trace.
- [x] 1.3 Implement the dedicated attention context inspector with item detail and cross-link traversal.

## 2. Panel refactors and runtime consumption

- [x] 2.1 Rework cycle detail to consume attention refs, merged tool traces, model-call records, and egress outcomes instead of `inputs / facts / reply` buckets.
- [x] 2.2 Update Devtools panel ownership so each heavy panel keeps isolated subscriptions, explicit loading states, and one primary scroll viewport.
- [x] 2.3 Remove raw technical attention activity from the Chat transcript while preserving expert affordances that link a delivered message back to Devtools.

## 3. Verification and rollout proof

- [x] 3.1 Add Storybook DOM coverage for the attention-first Devtools panels, context inspector, cycle detail, and loading-state variants.
- [x] 3.2 Run desktop and mobile browser walkthroughs that prove the new Devtools IA and Chat-to-Devtools boundary.
- [x] 3.3 Audit residual UI strings, selectors, and docs so old `LoopBus / facts / reply` terminology no longer defines the frontend architecture.
