## 1. Contract

- [x] 1.1 Add delta spec for truthful root workspace curl failure semantics

## 2. Implementation

- [x] 2.1 Inject a truthful root-workspace fetch path so dead loopback / transport failures surface as command failure instead of fabricated HTTP success
- [x] 2.2 Keep successful root workspace curl verification behavior intact for live loopback services

## 3. Validation

- [x] 3.1 Add regression coverage for dead-port curl checks in `workspace-system.test.ts`
- [x] 3.2 Re-run targeted workspace/runtime tests to confirm the shell surface stays green
