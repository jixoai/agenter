## 1. Spec And Primitive Definition

- [x] 1.1 Author the scrollview proposal, design, and capability spec.
- [x] 1.2 Update durable best-practice documents so they explicitly require `ScrollView` instead of raw `overflow-*`.
- [x] 1.3 Define the Svelte `ScrollView` API and the small allowlist for internal exceptions.

## 2. Primitive Implementation

- [x] 2.1 Implement `ScrollView` with static and virtual modes, axis selection, and shared scrollbar styling.
- [x] 2.2 Wrap shadcn-svelte dialogs, sheets, tabs, and surface shells so scroll ownership goes through the shared primitive.
- [x] 2.3 Add helpers or lint-style verification that flag raw scroll ownership in feature code.

## 3. Adoption And Verification

- [x] 3.1 Replace scaffold-level and system-level raw scroll usage with `ScrollView`.
- [x] 3.2 Add Storybook DOM coverage for representative static and virtual scroll surfaces.
- [x] 3.3 Run typecheck/tests and confirm desktop/mobile scroll behavior remains stable.
