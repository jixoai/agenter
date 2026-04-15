## 1. Spec and durable guidance

- [x] 1.1 Add OpenSpec deltas for stdin-first descriptor help, UTF-8 payload fidelity, and distributed guidance updates.

## 2. Runtime help and parsing

- [x] 2.1 Reorder descriptor-backed help/examples so `root_workspace_bash.command + stdin` is the preferred default and argv stays a compact fallback.
- [x] 2.2 Preserve UTF-8 JSON payload content when shell transport produces conservatively repairable mojibake before descriptor parsing.

## 3. Skills, prompts, and verification

- [x] 3.1 Update built-in runtime skills, references, and prompt guidance to teach stdin-first JSON transport.
- [x] 3.2 Add or update runtime CLI and guidance regression tests for help ordering, stdin-first wording, and Unicode payload preservation.
