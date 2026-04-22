# 2026-04-23 Terminal input modes implementation green pass

## Objective facts

- Active OpenSpec change: `stabilize-terminal-input-modes`
- This round finished the missing proof work instead of reopening design:
  - reran the latest targeted BDD suites after the final raw/mixed patches
  - rebuilt the runtime built-in skill catalog
  - scanned for old terminal-input residues such as `writeMixed`, `submitGapMs`, and legacy pending suffixes
  - removed one real residue from `packages/terminal-system/README.md`

## Platform changes confirmed

- Terminal automation law is now explicit and durable:
  - raw automation goes through pending `.raw.txt`
  - mixed automation goes through pending `.mixed.txt`
  - interactive PTY forwarding stays on `writeRaw(...)`
- Mixed DSL now supports `<raw>...</raw>` with fixed entity decoding.
- Runtime/control-plane surface now exposes:
  - `terminal write` => raw mode
  - `terminal input` => mixed mode
- Runtime skills/help now teach:
  - when to choose raw vs mixed
  - when to escalate from `--help` to `skill info agenter-terminal`

## Verification evidence

- `bun test packages/client-sdk/test/runtime-store.test.ts`
  - pass, including the new mixed-mode global terminal projection scenario
- `bun test packages/app-server/test/agenter-ai.test.ts packages/app-server/test/workspace-system.test.ts packages/app-server/test/trpc-router.test.ts`
  - pass
- `bun test packages/terminal-system/test/input-parser.test.ts packages/terminal-system/test/input-inbox.test.ts packages/terminal-system/test/integration.test.ts packages/terminal-system/test/control-plane.test.ts packages/app-server/test/runtime-cli.test.ts packages/app-server/test/runtime-skills.test.ts packages/app-server/test/runtime-skill-guidance.test.ts`
  - pass
- `cd packages/app-server && bun run build:skills`
  - regenerated `src/generated/runtime-skill-catalog.generated.ts`

## Residue audit

- `rg -n "submitKey|submitGapMs|writeMixed\\(|input/pending/\\*\\.xml|\\.xml\\|\\*\\.txt" packages`
  - code residue: clean
  - allowed mentions remain only in:
    - specs that explicitly forbid the old fields
    - `workspace-workbench` generic `.xml` text preview classification, which is unrelated to terminal input protocol

## Notes

- The OpenSpec change now has its implementation tasks checked.
- Commit flow was split correctly:
  - `docs(spec)` first for change/spec/durable-contract truth
  - implementation commit follows with code/tests/tasks/log
