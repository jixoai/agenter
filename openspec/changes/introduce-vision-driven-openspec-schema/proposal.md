## Why

Agenter's current OpenSpec workflow can describe proposal/spec/design/tasks, but it does not preserve the user's original intent as the single truth or force the review loop back through that intent. The user requested a new project-specific schema where visual/product intent drives specs, BDD tasks, implementation, and self-review.

## What Changes

- **BREAKING**: Make `vision-driven` the project default OpenSpec schema for new changes.
- Add a project-local `openspec/schemas/vision-driven` workflow with artifacts:
  - `research-plan` -> `plans/plan.md`
  - `specs` -> `specs/**/*.md`
  - `tasks` -> `tasks.md`
  - `self-review` -> `review/self-review.md`
  - `self-review` also requires separate `review/self-review.html` evidence presentation
- Add a repo-owned controller script for platform rules the OpenSpec schema DAG cannot enforce by itself:
  - plan backup as `plans/plan-vN.md`
  - review iteration state
  - recurring-issue loop-back signal
  - workflow artifact checks
- Keep existing active and archived `spec-driven` changes valid through their `.openspec.yaml` metadata.

## Capabilities

### New Capabilities

- `vision-driven-openspec-workflow`

### Modified Capabilities

- None

## Impact

- Affected documentation: `SPEC.md`, `openspec/config.yaml`, new `openspec/specs/vision-driven-openspec-workflow/spec.md`.
- Affected tools: OpenSpec project-local schema discovery, `scripts/openspec/vision-driven.ts`.
- Affected workflow: future `openspec new change <name>` defaults to `vision-driven`; old changes with metadata remain on `spec-driven`.
