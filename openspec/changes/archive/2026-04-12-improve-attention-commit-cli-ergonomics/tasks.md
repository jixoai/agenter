## 1. Contract

- [x] 1.1 Record runtime attention CLI ergonomics and done semantics in delta spec

## 2. Implementation

- [x] 2.1 Extend `attention commit` CLI parsing to accept common flag-form input while preserving JSON/stdin input
- [x] 2.2 Unify runtime-local attention commit handling so `done` without explicit scores resolves current active score keys to zero
- [x] 2.3 Update runtime attention skill guidance to recommend the ergonomic shell form for common settle flows

## 3. Validation

- [x] 3.1 Add regression coverage for flag-form `attention commit` resolution flows
- [x] 3.2 Re-run real single-avatar delivery and cold-restart scenarios to verify attention convergence
