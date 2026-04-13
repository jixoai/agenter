## Context

`@agenter/webui` uses Storybook in two roles: browser-driven DOM contract tests and a static Storybook build for publishing and local inspection. Under the current lockfile, `storybook build` crashes with `SIGILL` after Vite finishes transforming the full workbench/workspace story graph, while the same machine can successfully build an official minimal SvelteKit + Storybook 10.3.5 project. The repository also carries a global patch for `@storybook/addon-svelte-csf`, so any dependency bump must keep that patch applied.

## Goals / Non-Goals

**Goals:**

- Restore a successful `pnpm --filter '@agenter/webui' storybook:build` path without weakening existing Storybook DOM coverage.
- Keep the Storybook packages aligned on one compatible upstream patch line.
- Preserve the existing `@storybook/addon-svelte-csf` patch unless the upgrade makes it unnecessary and verified-safe to remove.

**Non-Goals:**

- Rework Storybook story content, workbench components, or DOM test architecture.
- Replace the current Storybook/SvelteKit integration with a custom builder.
- Remove the repository-wide `@storybook/addon-svelte-csf` patch in this change.

## Decisions

### Upgrade the official Storybook packages together

The fix is to move the WebUI Storybook packages from `10.3.4` to `10.3.5` as one aligned dependency set. The failure reproduces only in the repository dependency graph and disappears once the package uses the newer official patch line, so a coordinated upgrade is lower-risk than introducing builder-specific workarounds.

Alternative considered:

- Keep `10.3.4` and add more custom Vite/Storybook glue. Rejected because the crash happens even with a stripped-down local Storybook config, which means more local glue would only hide the upstream defect.

### Keep the existing `@storybook/addon-svelte-csf` patch in place

The repo already depends on a patch that broadens `defineMeta` extraction for Svelte CSF. The upgrade must continue to install with that patch applied, because removing it would be an unrelated behavior change with its own regression surface.

Alternative considered:

- Drop the patch during the upgrade. Rejected because the current change only targets static build stability, not CSF parser behavior.

### Treat static build stability as a durable WebUI tooling contract

This change adds a new capability spec so Storybook DOM tests and static Storybook builds remain tied together as one engineering contract. The package is not allowed to keep a green `test:dom` while `storybook:build` is silently broken.

## Risks / Trade-offs

- [Risk] A Storybook patch upgrade may pull newer transitive tooling into the workspace lockfile. → Mitigation: keep the manifest change scoped to `packages/webui` and verify only the lockfile deltas required to satisfy the aligned Storybook toolchain.
- [Risk] The global `@storybook/addon-svelte-csf` patch could stop applying on a future bump. → Mitigation: verify install success after the upgrade and document the patch compatibility requirement in the tooling contract.
- [Risk] Static build success could mask regressions in DOM tests, or vice versa. → Mitigation: verify both `storybook:build` and the focused Storybook DOM regression suite before closing the change.

## Migration Plan

1. Update the WebUI Storybook package versions to the compatible upstream patch line and refresh the lockfile.
2. Verify `pnpm --filter '@agenter/webui' storybook:build`.
3. Re-run the focused Storybook DOM regression suite that covers the workbench/runtime stories touched by the recent refactor.
4. Sync the durable tooling contract into the main specs before archive.

Rollback strategy: revert the WebUI Storybook dependency bump and lockfile changes as one unit if either static build or DOM regressions fail.

## Open Questions

- None.
