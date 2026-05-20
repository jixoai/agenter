# Handoff: refine-cli-shell-chat-scrollbox

## Goal

Repair cli-shell native Chat scroll physics by replacing product-local `dialogueScrollOffset` reverse-offset math with native OpenTUI scroll container semantics and MessageRoom-backed incremental history paging.

The change is OpenSpec `refine-cli-shell-chat-scrollbox`, schema `spec-driven`.

The intended law from the change artifacts:

- MessageRoom owns durable transcript truth.
- cli-shell owns only an ephemeral loaded message window.
- OpenTUI owns native viewport mechanics.
- Older history loads through `pageGlobalRoomMessages({ chatId, before: nextBefore, limit })`.
- Prepending older messages preserves a stable visible anchor.
- Bottom-pinned Chat follows new messages; scrolled-up Chat preserves reader position and shows return-to-bottom affordance.

## Current Progress

Confirmed from `openspec status --change refine-cli-shell-chat-scrollbox --json` and `openspec instructions apply --change refine-cli-shell-chat-scrollbox --json`:

- Artifacts are complete: `proposal`, `design`, `specs`, `tasks`.
- Tasks are `0/27`; none are checked off.
- State is `ready`; apply instructions say to read context files and work pending tasks.
- `openspec validate refine-cli-shell-chat-scrollbox --strict` passes.

Current `main` has uncommitted WIP for this change. Dirty/untracked files observed:

- `openspec/changes/refine-cli-shell-chat-scrollbox/.openspec.yaml`
- `openspec/changes/refine-cli-shell-chat-scrollbox/design.md`
- `openspec/changes/refine-cli-shell-chat-scrollbox/proposal.md`
- `openspec/changes/refine-cli-shell-chat-scrollbox/specs/cli-shell-product/spec.md`
- `openspec/changes/refine-cli-shell-chat-scrollbox/specs/message-chat-control-plane/spec.md`
- `openspec/changes/refine-cli-shell-chat-scrollbox/tasks.md`
- `packages/cli-shell/src/index.ts`
- `packages/cli-shell/src/tui/controller.ts`
- `packages/cli-shell/src/tui/core-app.ts`
- `packages/cli-shell/src/tui/dialogue-backend.ts`
- `packages/cli-shell/src/tui/dialogue-surface.ts`
- `packages/cli-shell/src/tui/model.ts`
- `packages/cli-shell/src/tui/types.ts`
- `packages/cli-shell/src/tui/view-state.ts`
- `packages/cli-shell/src/web/web-product-host.ts`
- `packages/cli-shell/test/cli-shell-termless-walkthrough.test.ts`
- `packages/cli-shell/test/cli-shell-tui.test.ts`
- `packages/cli-shell/src/tui/dialogue-scrollbox.ts`

These WIP changes were present on `main` after Studio landing and are not part of the Studio migration commits.

## What Worked

The WIP already introduces several promising pieces:

- `packages/cli-shell/src/tui/dialogue-scrollbox.ts` with scroll metrics, message window, dedupe/sort, anchor capture/restore, older-page loading, and a `CliShellDialogueScrollBoxController` wrapper around OpenTUI `ScrollBoxRenderable`.
- Public exports from `packages/cli-shell/src/index.ts`.
- Model shape moves from `dialogueScrollOffset` toward `dialogueScrollTop`, `dialogueScroll`, and `dialogueWindow`.
- Store harness now includes `pageGlobalRoomMessages`.
- Tests were added around ScrollBox ownership, scroll direction, older-message loading, anchor preservation, and bottom pinning.
- Web product host and backend projection were partially updated from `offsetFromBottom` to `scrollTop`/`maxScrollTop`.

## What Didn't Work

This is not finished and should not be presented as complete:

- `tasks.md` still has 0/27 checked.
- The WIP has not been committed.
- I did not run focused cli-shell tests or typecheck for this WIP during handoff.
- `git diff --name-only` shows `dialogue-backend.ts`, `web-product-host.ts`, and `cli-shell-termless-walkthrough.test.ts` in addition to the first visible diff set; include them in review.
- The WIP is on the main checkout, not isolated in a worktree. Create a worktree or snapshot branch before further risky edits if you want stricter isolation.

## Next Steps

Recommended handoff path for the main-branch developer:

1. Decide whether to keep this WIP on `main` or move it to a dedicated worktree/branch before implementation continues.
2. Read the change artifacts under `openspec/changes/refine-cli-shell-chat-scrollbox/`.
3. Run the current focused tests to establish exact failure/pass state:
   - `bun test packages/cli-shell/test/cli-shell-tui.test.ts --timeout 120000`
   - `bun test packages/cli-shell/test/cli-shell-termless-walkthrough.test.ts --timeout 120000`
   - `bun run --filter '@agenter/cli-shell' typecheck`
4. Complete tasks in order, checking them off only after behavior and verification are real.
5. Required final gates from tasks:
   - focused cli-shell TUI tests
   - focused cli-shell web-host tests only if shared room pagination helpers changed
   - `bun run --filter '@agenter/cli-shell' typecheck`
   - `openspec validate refine-cli-shell-chat-scrollbox --strict`
   - `openspec validate --specs --strict`
   - `git diff --check`
