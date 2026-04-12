## 1. OpenSpec contract

- [x] 1.1 Add the `runtime-json-tool-descriptor-surface` spec covering shared descriptors, JSON-only CLI input, and descriptor-driven help/skills
- [x] 1.2 Confirm the breaking change boundary: no natural-form compatibility, no positional CLI fallback, no local-only shell semantics

## 2. Platform law refactor

- [x] 2.1 Add a shared runtime tool descriptor registry for `attention` / `message` / `workspace` / `terminal`
- [x] 2.2 Refactor `runtime-local-api.ts` to dispatch routes from descriptors instead of a hand-written route table
- [x] 2.3 Refactor `runtime-cli.ts` to generate namespace/subcommand behavior, JSON parsing, and `--help` from descriptors

## 3. Skill and shell discoverability

- [x] 3.1 Update runtime built-in skills so all canonical command examples are JSON-only and point to `--help` / `ccski info`
- [x] 3.2 Update shell-facing tests and helper assertions that still rely on legacy flag or positional syntax

## 4. Validation

- [x] 4.1 Rewrite runtime CLI tests for JSON argv, JSON stdin, generated help output, and legacy syntax rejection
- [x] 4.2 Run targeted backend validation plus real AI room-terminal regression, and inspect real bash tool usage to confirm the new contract is actually followed
