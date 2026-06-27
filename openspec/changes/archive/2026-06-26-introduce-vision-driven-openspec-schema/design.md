## Context

OpenSpec 1.3.1 supports project-local schemas at `openspec/schemas/<name>/schema.yaml` and resolves them before user/package schemas. That is enough to define artifact order and templates. It is not enough to enforce iterative review counters, plan backups, or repeated-issue routing, because schema metadata only models artifact dependencies and apply tracking.

The user asked for a workflow where the Intent Document is the SSOT and where self-review can loop back into research-plan until the implementation aligns with intent.

## Goals / Non-Goals

Goals:

- Make `vision-driven` the default workflow for future Agenter changes.
- Preserve existing `spec-driven` changes through per-change metadata.
- Encode the artifact DAG in OpenSpec schema.
- Encode non-DAG workflow law in a repo-owned controller script.
- Add BDD coverage for schema shape and controller behavior.

Non-Goals:

- Modify the upstream `@fission-ai/openspec` package.
- Migrate every existing change directory to `vision-driven`.
- Add a Studio UI for workflow state in this change.
- Automate agent persona behavior beyond schema instructions and controller checkpoints.

## Decisions

### 1. Project-local schema owns artifact order

`openspec/schemas/vision-driven/schema.yaml` is the canonical schema. It declares:

- `research-plan` first, generating `plans/plan.md`
- `specs` after research-plan
- `tasks` after specs
- `self-review` after tasks
- apply tracking through `tasks.md`

Alternative considered: Keep `spec-driven` and add rules to `openspec/config.yaml`. Rejected because rules cannot change artifact identities or output paths.

### 2. Controller script owns loop mechanics

`scripts/openspec/vision-driven.ts` owns:

- `backup-plan`
- `review-state`
- `check`

This is a platform law because it makes the loop measurable instead of depending on chat discipline.

Alternative considered: Put all loop rules into schema instructions. Rejected because instructions can be ignored and cannot maintain state.

### 3. Default schema changes, old changes keep metadata

`openspec/config.yaml` changes to `schema: vision-driven`. Existing changes already have `.openspec.yaml` with `schema: spec-driven`, so they keep resolving against the old workflow.

Alternative considered: Migrate every active change. Rejected as unnecessary blast radius for this schema introduction.

## Risks / Trade-offs

- [Risk] `vision-driven` is stricter and creates more artifacts than small fixes need. -> Mitigation: this is intentional for Agenter; small local fixes can still explicitly use `--schema spec-driven` if the user asks.
- [Risk] Upstream OpenSpec schema commands are experimental. -> Mitigation: keep schema project-local and validate through `openspec schema validate vision-driven`.
- [Risk] Controller script can drift from schema. -> Mitigation: add BDD tests and make `check` validate the expected artifact surface.

## Migration Plan

1. Add project-local schema and templates.
2. Change project default schema to `vision-driven`.
3. Add controller script and tests.
4. Validate schema and create a demo change to prove OpenSpec resolves `vision-driven`.
5. Keep existing change metadata untouched.

Rollback is code-level: restore `openspec/config.yaml` to `spec-driven` and remove the new schema/script/test files.
