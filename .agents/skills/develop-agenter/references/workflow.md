# Workflow Reference

## BDD-First Testing

- Prefer behavior-first tests over implementation-detail assertions.
- Use:
  - `Feature: ...`
  - `Scenario: Given ... When ... Then ...`
- Keep the split:
  - E2E for cross-process critical paths
  - integration for protocol/runtime boundaries
  - unit for pure logic

## OpenSpec Boundaries

- `openspec/changes/*` is for active change artifacts.
- `openspec/specs/*` and `SPEC.md` files are durable truth.
- New OpenSpec work defaults to `vision2`: start with `bun run openspec:vision2 -- new <change>`, keep intent in `interview_plan.md`, track iteration findings as typed issues with `bun run openspec:vision2 -- issues <change> --new ...`, and close with `toc.md`.
- `vision2` issues are the iteration ledger: use `type`, `group`, `labels`, `depends_on`, `blocks`, `priority`, and `source` front matter for triage and dependency law; use `issues --validate`, `issues --group-by <group|label|state|type>`, and `check` for proof.
- `bun run openspec:vision -- ...` is retained only for existing `schema: vision-driven` changes or explicit legacy requests.
- Archive only after:
  - implementation is done
  - main specs are synced
  - tasks reflect the work that actually landed
- Keep these commit boundaries separate:
  - spec updates
  - implementation + tests
  - archive/spec-sync finalization

## Durable Docs Boundaries

- `AGENTS.md`: engineering collaboration law and meta-consciousness
- `SPEC.md` / `packages/*/SPEC.md`: platform/runtime contract
- `DESIGN.md`: visual and information-architecture law
- Skills: detailed repo workflow and reusable execution guidance

## Release / Distribution Rules

- Treat generated package/release manifests as the publish truth.
- GitHub release archives are the binary truth for `agenter`.
- npm wrapper packages and Homebrew are projections of that truth.
- When release verification fails, first distinguish:
  - current-release responsibility
  - historical package drift
- For release work, prefer narrow targeted verification:
  - `bun test scripts/release/...`
  - `bun run release:build-bundles:host-smoke`
  - `npm pack --dry-run` or equivalent smoke checks

## Git Worktree / Merge Discipline

- Worktree is the default isolation unit for multi-step or risky work.
- Use the repo’s canonical `.gemini/scripts/wt-*.sh` helpers.
- Merge readiness must name the target ref explicitly.
- Dirty target branches must be snapshotted before merge verification.
- Merge simulation belongs in an isolated verification worktree, not the user’s working checkout.

## Frontend Evidence Flow

- For pure frontend route/layout work:
  - capture before evidence first
  - change code
  - capture after evidence on the same route and viewport set
- Route-level evidence beats component stand-ins for page/shell changes.
- Desktop + `iPhone 14` mobile are both required unless the task says otherwise.
