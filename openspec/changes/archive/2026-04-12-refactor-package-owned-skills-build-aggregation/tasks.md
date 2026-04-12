## 1. OpenSpec contract

- [x] 1.1 Add the `runtime-builtin-skill-catalog` spec covering package-owned skill sources, generated catalog aggregation, and discoverability precedence
- [x] 1.2 Confirm the breaking boundary: built-in runtime skills are no longer written into `<rootWorkspace>/skills`

## 2. Platform law refactor

- [x] 2.1 Add package-owned `skills/**/SKILL.md` sources for runtime, workspace, collaboration, attention, message, and terminal skills
- [x] 2.2 Add a runtime skill catalog builder plus generated manifest under `packages/app-server`
- [x] 2.3 Refactor `runtime-skills.ts` and `session-runtime.ts` to consume the generated built-in catalog instead of writing built-ins into the root workspace

## 3. Validation

- [x] 3.1 Add BDD unit tests for catalog aggregation, runtime slot rendering, and built-in/on-disk precedence
- [x] 3.2 Run targeted backend validation plus real AI room-terminal regression, and inspect real bash usage to confirm the model still discovers skills through `ccski info` / `--help`
