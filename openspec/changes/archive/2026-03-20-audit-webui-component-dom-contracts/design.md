## Context

The repository already uses Storybook v10 plus Vitest browser tests as the preferred DOM contract layer for WebUI. The current dirty surface has good route-level coverage, but some high-interaction subcomponents still sit inside large files (`ChatConversationRows`, `LoopBusPanel`) or only inherit coverage indirectly through parent stories. This change keeps the product behavior stable while making those surfaces independently testable and easier to evolve.

## Goals / Non-Goals

**Goals:**
- Isolate the current dirty Chat and LoopBus interaction surfaces into smaller props-driven components.
- Add direct Storybook DOM contracts for high-interaction subcomponents that currently lack their own coverage.
- Preserve current chat-first and devtools-secondary behavior while improving regression isolation.

**Non-Goals:**
- Re-audit the entire WebUI tree.
- Change transport, runtime-store, or app-server behavior.
- Introduce stories for shell-only integration roots such as `AppRoot`.

## Decisions

- Split Chat transcript rendering around reusable bubble/action primitives instead of keeping gesture logic, menu actions, and bubble markup in one file.
  - Alternative considered: keep the monolith and only add more `ChatPanel` stories. Rejected because failures would still land at the route level and keep the component hard to evolve.
- Keep `ChatConversationViewport` as the scroll owner, but add direct contracts for attachment and bubble subcomponents instead of forcing every interaction through `ChatPanel`.
  - Alternative considered: fully decompose viewport state machines in this pass. Rejected as too much churn for a self-review follow-up.
- Split `LoopBusPanel` by tab/content responsibility (`flow`, `trace`, `model`) while keeping the existing public props contract stable.
  - Alternative considered: only add a story around the current file. Rejected because the file is already too large and mixes unrelated rendering responsibilities.
- Use Storybook DOM tests for all newly isolated interaction surfaces.
  - Alternative considered: jsdom-only tests. Rejected because tabs, menus, virtualization, and touch gestures are better covered in the existing browser-test stack.

## Risks / Trade-offs

- [Refactor churn in an already dirty tree] -> Keep public props stable and limit work to current dirty WebUI surfaces.
- [Extra stories increase maintenance] -> Only add stories for independently meaningful interaction surfaces, not for shell-only wrappers.
- [LoopBus split could duplicate helper logic] -> Extract shared formatting/helpers once and keep tab panels props-driven.
