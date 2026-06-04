---
name: develop-agenter
description: Repo-specific development workflow for agenter. Use when implementing, reviewing, or archiving changes in this repository, especially for OpenSpec work, release tooling, Studio UI, Storybook DOM tests, viewport/browser walkthroughs, worktree discipline, or repo-level docs/spec updates.
---

# Develop Agenter

## Overview

Use this skill for the repo-specific rules that are too detailed for the project `AGENTS.md` but still shape day-to-day work in `agenter`.

## Workflow Router

- For OpenSpec lifecycle, release/distribution tooling, git worktree discipline, and durable doc boundaries, read [references/workflow.md](references/workflow.md).
- For Studio UI, Storybook DOM tests, viewport coverage, browser walkthroughs, layout primitives, and visual/system affordance rules, read [references/studio-ui.md](references/studio-ui.md).

## Core Execution Rules

1. Start from repo truth:
   - inspect `git status --short`
   - isolate owned changes before editing
   - read the nearest durable contract when behavior changes (`SPEC.md`, package `SPEC.md`, `DESIGN.md`, active OpenSpec files)
2. Keep commit boundaries clean:
   - OpenSpec spec changes, implementation, and archive are separate commits
   - do not mix unrelated dirty files into a fix
3. Verify the highest-risk path with evidence:
   - package/release work: run the targeted release tests and smoke packaging checks
   - Studio UI work: run real DOM/browser evidence, not only mocked jsdom
4. Prefer narrow fixes that preserve repo laws:
   - release truth stays file-backed and machine-readable
   - install surfaces are projections of canonical truth, not ad hoc rebuilds
   - UI/layout primitives own repeated rules, feature code should not hand-roll them

## Task Heuristics

- If the task touches `openspec/`, archive state, `SPEC.md`, release workflows, npm/Homebrew distribution, or worktrees, read `references/workflow.md` first.
- If the task touches `apps/studio`, shared UI primitives, responsive layout, Storybook DOM, or browser QA, read `references/studio-ui.md` first.
- If both apply, read `workflow.md` first, then `studio-ui.md`.

## Output Discipline

- Report facts before conclusions.
- Use the repo’s BDD naming (`Feature:` / `Scenario: Given / When / Then`) in new tests.
- When changing durable behavior, make sure docs and specs land in the same round instead of leaving drift behind.
