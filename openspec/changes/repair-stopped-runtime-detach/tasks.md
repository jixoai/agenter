## 1. Lifecycle repair

- [ ] 1.1 Update `AppKernel.stopSession()` so stop uses full runtime teardown and detaches runtime ownership from the kernel
- [ ] 1.2 Rewrite the kernel lifecycle test that still expects stop to keep the runtime in memory

## 2. Persisted-truth regression coverage

- [ ] 2.1 Add a backend regression test that proves stopped-session notification or attention reads come from persisted attention state
- [ ] 2.2 Re-run `@agenter/app-server` workspace-attention harness and targeted type/tests to confirm the stopped-session fallback law
