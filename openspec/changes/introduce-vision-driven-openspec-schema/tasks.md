## 1. BDD Contract

- [x] 1.1 Add a behavior test proving the project default schema is `vision-driven` and its artifact DAG starts from `research-plan`.
- [x] 1.2 Add a behavior test proving `backup-plan` versions the current Intent Document before revision.
- [x] 1.3 Add a behavior test proving repeated review issues produce a loop-back signal.
- [x] 1.4 Add a behavior test proving missing review proof fails the workflow check.

## 2. Platform Schema

- [x] 2.1 Add `openspec/schemas/vision-driven/schema.yaml` with `research-plan`, `specs`, `tasks`, and `self-review` artifacts.
- [x] 2.2 Add templates for `plans/plan.md`, OpenSpec-compatible spec files, checkbox tasks, and HTML self-review.
- [x] 2.3 Change `openspec/config.yaml` to default future changes to `vision-driven`.

## 3. Controller

- [x] 3.1 Add a repo-owned controller script for plan backup, review iteration state, recurring issue detection, and artifact checks.
- [x] 3.2 Keep controller behavior independent from upstream OpenSpec internals beyond change directory layout.

## 4. Spec Governance

- [x] 4.1 Add a delta spec for `vision-driven-openspec-workflow`.
- [x] 4.2 Add the durable main spec because this is a long-term project workflow law.

## 5. Verification

- [x] 5.1 Run the focused BDD test for the controller and schema contract.
- [x] 5.2 Run `openspec schema validate vision-driven`.
- [x] 5.3 Create and inspect a temporary demo change with the default `vision-driven` schema.
- [x] 5.4 Run `openspec validate introduce-vision-driven-openspec-schema --strict`.

## 6. Git Evidence Workflow

- [ ] 6.1 Add schema and template rules requiring an OpenSpec commit before apply, task-progress commits during apply, and OpenSpec commits after self-review changes.
- [ ] 6.2 Add workflow guidance that an agent may only check off tasks it completed and verified in the current working context.
- [ ] 6.3 Add schema and template rules requiring concise intent comments at critical implementation effect points.

## 7. Abnormal Exit And Realignment

- [ ] 7.1 Add change-local `HANDOFF.md` generation for abnormal self-review exits, including `vN.HANDOFF.md` preservation.
- [ ] 7.2 Add safe change rename support for discussion-driven realignment after self-review.
- [ ] 7.3 Add normal-exit guidance to archive with `openspec archive <change>` and commit the archive result.

## 8. Verification For Evidence Workflow

- [ ] 8.1 Add BDD tests for Git evidence guidance, handoff generation, handoff versioning, and rename behavior.
- [ ] 8.2 Run `bun test scripts/openspec/vision-driven.test.ts`.
- [ ] 8.3 Run `openspec validate introduce-vision-driven-openspec-schema --type change --strict`.
- [ ] 8.4 Run `openspec validate --specs --strict`.
