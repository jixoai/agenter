---
title: CLI surface shape - archive as --archive flag vs new top-level command
state: closed
github_issue_status: closed
---

## Summary

During the interview it was unclear whether the archive operation should be exposed as a `--archive` flag on the existing `issues <change>` command (e.g. `issues <change> --archive`) or as a brand-new top-level command (e.g. `archive <change>`). The choice affects operator ergonomics, help-text grouping, and how discoverable the feature is.

## Impact

This determines the command surface documented in the spec's first requirement and the controller's argument-parsing branch. Picking wrong means reworking the spec and the implementation; it is a decision that should be locked before apply, not discovered mid-implementation.

## Evidence

- `scripts/openspec/vision2-driven.ts:155-188` (`listOrValidateIssues`): the `issues` command already accepts a `--validate` flag, establishing a flag-based extension pattern for issue lifecycle actions.
- `interview_plan.md` Q&A ledger Q7: recommended answer was the `--archive` flag form, citing cohesion with the existing `issues` command.
- `openspec/schemas/vision2/schema.yaml`: the schema's `close` instruction and the controller's `commit-check` phases treat `archive` as a commit-phase concept, not as a dedicated workflow command, so a new top-level `archive` command risks colliding with the phase vocabulary.

## Resolution

Adopt the flag form `bun run openspec:vision2 -- issues <change> --archive` as the default in the spec. This is recorded as a User Confirmation Gate (Gate 1 in `interview_plan.md`) and stays reversible: if the user prefers a top-level command during review, only the spec's "invoked via" clause and the controller's arg parser need to change. No implementation work is blocked by this decision because the spec now names the flag form explicitly.
