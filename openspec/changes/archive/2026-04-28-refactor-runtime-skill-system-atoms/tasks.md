## 1. Runtime Refactor

- [x] 1.1 Add atom modules for truth snapshots, diffing, baseline storage, watcher dirtiness, and ingress publishing.
- [x] 1.2 Rewire `RuntimeSkillSystem` to coordinate those atoms while preserving its public API.
- [x] 1.3 Keep `skill.name` as the sole diff/override identity and preserve stable observed-file fingerprinting.

## 2. Specs and Tests

- [x] 2.1 Update durable specs with the atom boundary law.
- [x] 2.2 Add BDD unit coverage for the new atom boundaries.
- [x] 2.3 Run targeted runtime skill/session tests and typecheck.
