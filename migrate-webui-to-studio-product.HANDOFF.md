# Handoff: migrate-webui-to-studio-product

## Goal

Break the old core-owned WebUI delivery law and make the active operator web product an ecosystem package:

- `packages/webui` / `@agenter/webui` becomes `packages/studio` / `@agenter/studio`.
- `agenter studio` is descriptor-driven like `agenter shell`.
- `agenter web` is removed without compatibility alias.
- `packages/ui-studio` / `@agenter/ui-studio` becomes `packages/icon-studio` / `@agenter/icon-studio`.

The change is OpenSpec `migrate-webui-to-studio-product`, schema `spec-driven`.

## Current Progress

Confirmed from `openspec status --change migrate-webui-to-studio-product --json` and `openspec instructions apply --change migrate-webui-to-studio-product --json`:

- Artifacts are complete: `proposal`, `design`, `specs`, `tasks`.
- Tasks are complete: `24/24`.
- State is `all_done`; OpenSpec says the change is ready to archive after review.

Landed on `main` with:

- `41469166 docs(spec): propose studio product migration`
- `462a3db1 feat: migrate webui to studio product`
- `d8b2ac8b docs(spec): close studio product migration tasks`

Feature worktree and branch were cleaned:

- Worktree removed: `.worktree/migrate-webui-to-studio-product`
- Branch removed: `feature/migrate-webui-to-studio-product`

## What Worked

Verified before landing:

- `bun test packages/cli/test/product-command-launcher.test.ts packages/product-extension-runtime/test/product-extension-runtime.test.ts packages/studio/test/static-root.test.ts --timeout 30000`
- `bun run --filter '@agenter/icon-studio' typecheck`
- `bun run --filter '@agenter/studio' typecheck`
- `bun run --filter '@agenter/studio' test:unit`
- `bun run --filter '@agenter/icon-studio' test`
- `bun run --filter '@agenter/icon-studio' build`
- `bun run --filter '@agenter/studio' build`
- `bun run --filter '@agenter/studio' test:dom`
- `openspec validate migrate-webui-to-studio-product --strict`
- `openspec validate --specs --strict`
- `git diff --check`
- `./.gemini/scripts/wt-merge-verify.sh --target main`
- `./.gemini/scripts/wt-land-ff.sh feature/migrate-webui-to-studio-product`

Important observed non-fatal warnings:

- `@agenter/studio build` exits 0 but reports existing lightningcss `:global(...)` warnings and plugin timing warnings.
- `@agenter/studio test:dom` exits 0 with a ghostty wasm 404 log; 22 files and 109 tests passed.
- `@agenter/icon-studio build` exits 0 with plugin timing and adapter-auto environment hints.

## What Didn't Work

- One attempted `apply_patch` targeted the main checkout path before using the worktree absolute path. It failed before writing anything.
- Main checkout had unrelated dirty/untracked work during landing. The ff-only landing script created snapshot ref `snapshot/main-pre-land-20260520T115721Z` and restored the non-overlapping untracked `openspec/changes/refine-cli-shell-chat-scrollbox/` path.

## Next Steps

Confirmed next workflow step is human/main-branch review, then archive if accepted:

- Review current `main` commits and product behavior.
- Re-run any desired acceptance gates on `main`.
- Archive `migrate-webui-to-studio-product` after acceptance.
- Be aware that current `main` also has unrelated WIP for `refine-cli-shell-chat-scrollbox`; do not mix that WIP into Studio archive unless intentionally continuing it.
