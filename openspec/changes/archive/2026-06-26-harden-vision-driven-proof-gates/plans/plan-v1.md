# Intent Document

## Current Round

- Round: 1
- Status: In progress
- Previous plan backup: None

## Original User Input

> self-review这份Schema，然后尝试性用这个新的流程随便找个任务试一下，看是否符合预期（你需要在当前worktree基础上，独立fork一个worktree去做测试。然后检查目标worktree的工作过程和结果）。评估并改进我们的Schema，直到符合预期效果

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record                                                    | Impact on intent                                                                                                |
| ---- | ------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | User    | Self-review the new schema.                                         | The workflow itself is the app under test.                                                                  |
| 2    | User    | Use the new workflow on a small real task.                          | The schema must survive real artifact creation, not only schema validation.                                     |
| 3    | User    | Fork an independent worktree from the current worktree for testing. | The evaluation must be isolated from the source feature branch.                                                 |
| 4    | User    | Check the target worktree's process and result.                     | We need both workflow execution evidence and output quality evidence.                                           |
| 5    | AI      | Chose `harden-vision-driven-proof-gates` as the test task.          | A self-hosted workflow hardening task exercises research, specs, tasks, implementation, and review in one loop. |

### Evidence Read

| Source                                                               | Fact                                                                                      | Why it matters                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `scripts/openspec/vision-driven.ts`                                  | `check` only validates schema metadata, file presence, and checkbox syntax.               | The workflow can be faked by empty proof artifacts.              |
| `openspec/specs/vision-driven-openspec-workflow/spec.md`             | The durable spec says self-review must record deviations and user-confirmation questions. | The proof gate should validate structure closer to the contract. |
| `openspec/changes/introduce-vision-driven-openspec-schema/design.md` | The controller exists because schema metadata alone cannot enforce loop law.              | Strengthening `check` is aligned with the original architecture. |
| `openspec/changes/introduce-vision-driven-openspec-schema/tasks.md`  | The first rollout only proved missing-file failure, not fake-proof failure.               | The BDD coverage is incomplete for the real threat model.        |

### Demo / Spike Code

| Path     | Question it answers | Keep, migrate, or delete |
| -------- | ------------------- | ------------------------ |
| None yet | N/A                 | N/A                      |

## Intent

### Surface Intent

Use the new `vision-driven` workflow in a separate worktree, inspect whether the process feels correct, and improve the schema when it falls short.

### Underlying Drive

The user does not want a decorative workflow. They want a development law that survives real use, catches fake completion, and produces artifacts that a app architect can trust without reading implementation code.

### Final Visible Effect

When a future agent runs this workflow, the change starts from a concrete intent document, the proof gate rejects empty or fake self-review artifacts, and the final review output visibly shows deviations, open questions, iteration state, and next action without relying on chat memory.

## Platform Diagnosis

- Current platform laws: OpenSpec project-local schema defines artifact order; `scripts/openspec/vision-driven.ts` enforces non-DAG mechanics.
- Does this fit as a regular atom: Yes. This is a law-tightening inside the controller/template surface that already owns workflow proof.
- Does this require law upgrade: Yes, but as an extension of the existing controller law rather than a new paradigm.
- Breaking update stance: Stricter proof validation is acceptable by default because this workflow is internal process law.
- User confirmations still required: None unless we decide to invalidate already-authored review artifacts outside this test branch.

## Reverse-Inferred Design

### Interaction / Visual Story

An agent creates a `vision-driven` change, writes `plans/plan.md`, derives spec and tasks, implements a small fix, then produces `review/self-review.html`. The proof gate should only pass if that review artifact actually contains the sections that let a human inspect deviations, questions, evidence, and loop state.

### Interface Shape

The controller should continue exposing small commands:

- `backup-plan <change>`
- `review-state <change>`
- `check <change>`

`check` should inspect artifact content, not only artifact existence.

### Data Shape

Durable facts:

- `plans/plan.md`
- `tasks.md`
- `review/self-review.html`
- `review/state.json`

Projection facts:

- whether the review artifact is structurally credible
- whether the workflow is ready to claim completion

These projections must be derived from file content, not chat claims.

### Architecture Shape

Keep OpenSpec schema responsible for artifact DAG and template guidance. Keep the repo-owned controller responsible for proof rules that require content inspection or persistent loop state. Do not move these checks into ad hoc human discipline.

## Intent-Driven Plan

- [ ] 1. Confirm the current workflow weakness with a real change.
- [ ] 2. Write a durable spec for stronger proof gates.
- [ ] 3. Add BDD tasks that fail on fake self-review proof and pass on real proof.
- [ ] 4. Implement controller/template/test updates.
- [ ] 5. Run self-review on both the test change and the schema itself.

## Open Questions

| Question                                                                                                  | Why it matters                                                  | Default assumption until user answers                                                                              |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Should `check` require `review/state.json` as part of proof, or only validate the HTML structure for now? | This changes how strict the workflow becomes for small changes. | Require HTML structure now and evaluate whether `review/state.json` should also be mandatory after the first loop. |

## Rejected Paths

| Path                                                                                  | Why rejected                                                                 |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Keep `check` as file-existence only and trust agents to fill review content honestly. | This fails the user's request for a workflow that survives real use.         |
| Move proof requirements only into prose instructions.                                 | Instructions are advisory; the controller exists to make the law measurable. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2
- Custom exit condition from intent: The test change must complete end-to-end in the isolated worktree, and the proof gate must reject fake review content while accepting a structurally valid self-review artifact.
