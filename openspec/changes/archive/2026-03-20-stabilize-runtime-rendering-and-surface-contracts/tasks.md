## 1. Runtime Publication

- [x] 1.1 Add the change artifacts for runtime UI publication and surface-contract stabilization
- [x] 1.2 Refactor `packages/client-sdk` runtime publication so hot runtime events are coalesced without losing facts
- [x] 1.3 Add selector-based WebUI runtime hooks and migrate shell-level consumers away from one broad mirrored runtime state

## 2. Surface Contracts

- [x] 2.1 Introduce semantic surface/background primitives and classify current raw `bg-*` ownership in `packages/webui`
- [x] 2.2 Refactor shell and panel composition so layout wrappers, scroll owners, clip surfaces, and semantic surfaces each own one role
- [x] 2.3 Update `AGENTS.md` with the stricter overflow/background best practices and approved exceptions

## 3. Verification

- [x] 3.1 Add unit coverage for coalesced runtime publication and selector isolation behavior
- [x] 3.2 Add source-contract and Storybook DOM coverage for overflow/background ownership and long-content shells
- [x] 3.3 Run focused WebUI/client-sdk tests plus browser performance verification in dev and production modes, then fix regressions until the change is ready
