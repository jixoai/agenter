# Intent Document

## Current Round

- Round: 3
- Status: Reframed after user feedback, implementation updated, self-reviewed
- Previous plan backup: `plans/plan-v2.md`

## Original User Input

> self-review这份Schema，然后尝试性用这个新的流程随便找个任务试一下，看是否符合预期（你需要在当前worktree基础上，独立fork一个worktree去做测试。然后检查目标worktree的工作过程和结果）。评估并改进我们的Schema，直到符合预期效果

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record                                                                                                           | Impact on intent                                                                                                 |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | User    | Self-review the new schema.                                                                                                | The workflow itself is the app under test.                                                                   |
| 2    | User    | Use the new workflow on a small real task.                                                                                 | The schema must survive real artifact creation, not only schema validation.                                      |
| 3    | User    | Fork an independent worktree from the current worktree for testing.                                                        | The evaluation must be isolated from the source feature branch.                                                  |
| 4    | User    | Check the target worktree's process and result.                                                                            | We need both workflow execution evidence and output quality evidence.                                            |
| 5    | AI      | Chose `harden-vision-driven-proof-gates` as the test task.                                                                 | A self-hosted workflow hardening task exercises research, specs, tasks, implementation, and review in one loop.  |
| 6    | Runtime | `openspec validate harden-vision-driven-proof-gates --strict` resolved as an unknown item until `--type change` was added. | The schema should guide agents toward explicit change validation syntax.                                         |
| 7    | User    | Prefer loose checks so AI can use its intelligence more freely.                                                            | The workflow should stop over-policing free-form review prose.                                                   |
| 8    | User    | The generated OpenSpec change files must still conform to spec.                                                            | Strictness should move to artifact presence and OpenSpec-valid file shape, not to rigid HTML section taxonomies. |

### Evidence Read

| Source                                                                                                    | Fact                                                                                                         | Why it matters                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `scripts/openspec/vision-driven.ts`                                                                       | `check` originally only validated schema metadata, file presence, and checkbox syntax.                       | This was too weak at first, but later we also learned it is possible to over-tighten review prose. |
| `openspec/specs/vision-driven-openspec-workflow/spec.md`                                                  | The durable spec says self-review must record deviations and user-confirmation questions.                    | The proof gate should validate structure closer to the contract.                                   |
| `openspec/changes/introduce-vision-driven-openspec-schema/design.md`                                      | The controller exists because schema metadata alone cannot enforce loop law.                                 | Strengthening `check` is aligned with the original architecture.                                   |
| `openspec/changes/introduce-vision-driven-openspec-schema/tasks.md`                                       | The first rollout only proved missing-file failure, not fake-proof failure.                                  | The BDD coverage is incomplete for the real threat model.                                          |
| `openspec validate --help` and a failed `openspec validate harden-vision-driven-proof-gates --strict` run | CLI change validation is safer with explicit `--type change`.                                                | The workflow template should teach the non-ambiguous command.                                      |
| User feedback after self-review of the original schema prompt                                             | Loose checks are preferred for AI-authored content, while OpenSpec change files still must conform strictly. | The final law should be strict about artifact validity, loose about HTML/report phrasing.          |

### Demo / Spike Code

| Path     | Question it answers | Keep, migrate, or delete |
| -------- | ------------------- | ------------------------ |
| None yet | N/A                 | N/A                      |

## Intent

### Surface Intent

Use the new `vision-driven` workflow in a separate worktree, inspect whether the process feels correct, and improve the schema when it falls short.

### Underlying Drive

The user wants a development law that survives real use, but they do not want the checker to crush the AI into filling a rigid report form. The real target is strictness on OpenSpec artifact conformance and workflow steps, while keeping room for intelligent, free-form review content.

### Final Visible Effect

When a future agent runs this workflow, the change starts from a concrete intent document, the generated OpenSpec files stay valid and reviewable, and the self-review HTML can stay free-form as long as the workflow artifacts exist and the report is not empty.

## Platform Diagnosis

- Current platform laws: OpenSpec project-local schema defines artifact order; `scripts/openspec/vision-driven.ts` enforces non-DAG mechanics.
- Does this fit as a regular atom: Yes. This is a law correction inside the controller/template surface that already owns workflow proof.
- Does this require law upgrade: Yes. The controller should validate artifact sanity without dictating review prose structure.
- Breaking update stance: Keep strictness on OpenSpec-valid artifact generation; avoid extra content-policing unless the user explicitly asks for it.
- User confirmations still required: None unless we decide to invalidate already-authored review artifacts outside this test branch.

## Reverse-Inferred Design

### Interaction / Visual Story

An agent creates a `vision-driven` change, writes `plans/plan.md`, derives spec and tasks, implements a small fix, then produces `review/self-review.html`. The workflow should ensure the change artifacts are present and valid, but the report itself can use whatever HTML structure best communicates the review.

### Interface Shape

The controller should continue exposing small commands:

- `backup-plan <change>`
- `review-state <change>`
- `check <change>`

`check` should inspect artifact presence and minimal format sanity, not prescribe a rigid HTML layout.

### Data Shape

Durable facts:

- `plans/plan.md`
- `tasks.md`
- `review/self-review.html`
- optional `review/state.json`

Projection facts:

- whether the workflow artifacts are present and sane
- whether an optional review loop state file is valid when used

These projections must come from files, but they should stay lightweight and avoid judging the quality of free-form review prose.

### Architecture Shape

Keep OpenSpec schema responsible for artifact DAG and template guidance. Keep the repo-owned controller responsible for lightweight sanity checks and optional loop-state tracking. Do not move OpenSpec conformance checks into ad hoc human discipline, and do not move prose-quality judgment into the controller.

## Intent-Driven Plan

- [x] 1. Confirm the current workflow weakness with a real change.
- [x] 2. Learn from user feedback where the first fix over-tightened the workflow.
- [x] 3. Shift strictness toward OpenSpec-valid artifact files and away from rigid review HTML policing.
- [x] 4. Update controller/template/test updates to reflect the looser-content / stricter-artifact law.
- [x] 5. Run self-review on both the test change and the schema itself.

## Open Questions

| Question                                                                                                                                        | Why it matters                                                              | Default assumption until user answers                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Should the workflow eventually wrap `openspec validate <change> --type change --strict` inside the controller for a single-command finish gate? | This affects whether future users need to remember raw OpenSpec CLI quirks. | Keep the explicit CLI command in tasks for now; only add a controller wrapper if repeated runs keep stumbling here. |

## Rejected Paths

| Path                                                                                       | Why rejected                                                                             |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Keep `check` as pure file-existence only and trust agents to fill review content honestly. | This is too weak for artifact sanity and optional state-file validation.                 |
| Force a rigid HTML section taxonomy into every self-review report.                         | This conflicts with the user's explicit preference for loose checks and more AI freedom. |
| Keep `openspec validate <change> --strict` as the recommended task syntax.                 | Real execution showed that explicit `--type change` is the safer contract.               |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2
- Custom exit condition from intent: The test change must complete end-to-end in the isolated worktree, OpenSpec artifact files must validate strictly, and free-form self-review HTML must pass without being forced into a rigid template grammar.
