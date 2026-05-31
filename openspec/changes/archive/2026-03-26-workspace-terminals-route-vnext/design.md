## Context

The app direction already accepts multi-message channels and multi-terminals as first-class runtime concepts, but the workspace shell still gives chats a primary route while burying terminals inside secondary tooling. The codebase already contains a dedicated `TerminalPanel` and terminal activity inspection path, so the problem is not missing atoms; it is that the shell hierarchy does not expose them directly.

## Goals / Non-Goals

**Goals:**
- Make terminals a first-class workspace route.
- Rename the chat tab to `Chats` to match the multi-channel architecture.
- Reuse the existing terminal panel and activity affordances instead of creating a second terminal UI.
- Keep top-header semantics compact and route-local.

**Non-Goals:**
- Redesign the terminal protocol or websocket transport.
- Reintroduce the old mixed `Systems` panel as the primary terminal entry point.
- Move global settings into the workspace shell.

## Decisions

### Workspace shell promotes terminals to a peer route
The workspace shell route set becomes `Chats / Terminals / Devtools / Settings`.

Why: terminals are a primary runtime system, not a secondary debug affordance.

Alternative considered: keep terminals only inside Devtools or Systems. Rejected because it keeps the shell teaching the wrong hierarchy.

### The terminal route reuses the existing terminal atom
The new route will reuse the current `TerminalPanel` and its activity loading contract.

Why: the terminal atom already exists and already consumes the runtime terminal contract directly.

Alternative considered: rebuild a separate terminal route component. Rejected because it duplicates surface logic and risks drift.

### Chats becomes plural at the shell boundary
The route label becomes `Chats`, while the route path may stay `chat` until a wider routing cleanup is justified.

Why: the shell should reflect the multi-chat-channel architecture even if the current path naming is still singular.

Alternative considered: rename route labels and paths in one step. Rejected because the route-path rename is independent and can be folded into a later navigation cleanup.

## Risks / Trade-offs

- [Adding one more top-level tab increases shell density] -> Mitigation: reuse the existing compact top-header/tab primitives and keep passive metadata out of the header.
- [Terminal panel was previously embedded under Systems] -> Mitigation: extract the shared route wiring from that code instead of copy-pasting divergent logic.
- [Desktop/mobile route behavior may drift] -> Mitigation: add story and DOM coverage for both viewport modes.

## Migration Plan

1. Add a dedicated workspace terminals route and route-local assembly.
2. Reuse terminal runtime selectors, paging loaders, and `TerminalPanel` wiring from the current secondary tooling path.
3. Update top-header/workspace-shell tab labels to `Chats / Terminals / Devtools / Settings`.
4. Add Storybook/DOM coverage for the new route on desktop and compact layouts.

## Open Questions

- Whether the future route-path cleanup should rename `/workspace/chat` to `/workspace/chats` or keep singular paths behind plural labels.
- Whether the old secondary Systems terminal entry should be reduced further once the standalone route is in place.
