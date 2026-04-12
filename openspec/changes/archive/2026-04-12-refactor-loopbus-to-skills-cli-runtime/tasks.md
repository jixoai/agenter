## 1. OpenSpec and contracts

- [x] 1.1 Sync runtime CLI/skills architecture decisions into durable delta specs
- [x] 1.2 Record backend/frontend integration notes for the new runtime API and shell model in `.chat`

## 2. Runtime foundations

- [x] 2.1 Add `homeDir` plumbing to kernel/runtime paths so root avatar homes and global skill roots are testable without polluting the real user home
- [x] 2.2 Add fixed root workspace attachment for each runtime using the avatar principal-address canonical home
- [x] 2.3 Extend runtime snapshots with root workspace and runtime-local attention API metadata

## 3. Attention API and shell surface

- [x] 3.1 Implement attention-scoped local API lifecycle inside `SessionRuntime`
- [x] 3.2 Implement runtime CLI handlers for `attention`, `message`, `workspace`, and `terminal`
- [x] 3.3 Implement root workspace bash execution over real absolute mounted paths and shell env injection
- [x] 3.4 Replace model direct tools with `root_workspace_list` and `root_workspace_bash`

## 4. Prompt and skills refactor

- [x] 4.1 Generate `skills.list` from runtime-visible skill roots and inject it into the system prompt
- [x] 4.2 Remove old bootstrap system-guide injection and shrink bootstrap inputs to minimal attention metadata
- [x] 4.3 Add built-in runtime skill files and `ccski` shell access for progressive discovery

## 5. Validation

- [x] 5.1 Update unit/integration coverage for root workspace mounts, attention API auth, and root workspace direct tools
- [x] 5.2 Rewrite real AI harness/scenarios to use CLI/skills flow and verify single-avatar delivery, cold restart recovery, and multi-avatar collaboration
- [x] 5.3 Run backend typecheck and targeted real AI validations, then mark any follow-up frontend suggestions in OpenSpec only

## 6. Closeout plan

- [x] 6.1 Physically remove stale `SessionRuntime` direct-tool remnants (`message_*`, `terminal_*`, old trace heuristics) that are no longer mounted into the model tool surface
- [x] 6.2 Remove or re-home dead pre-skills attention guide/bootstrap structures so LoopBus no longer carries unused system-guide builders
- [x] 6.3 Sync durable `SPEC.md` and `packages/app-server/SPEC.md` to the final CLI/skills runtime law
- [x] 6.4 Re-run targeted unit + real AI validations after cleanup and confirm the runtime still exposes only `root_workspace_list` / `root_workspace_bash`
- [x] 6.5 Archive the completed follow-up changes, then archive this main change once the closeout cleanup is green
