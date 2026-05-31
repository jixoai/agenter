## Legacy Residue And Cleanup Risk Audit

This audit records old `terminal-2` / composed TerminalSystem residue after moving
`agenter-app-shell` to `apps/cli-shell` and making tmux the active host.

The architectural rule is strict: cli-shell is an extension app. It may use
generic room, avatar, runtime, and attention APIs, but it must not make core
TerminalSystem data structures carry cli-shell-specific app roles.

## Active Path Status

- `apps/cli-shell/src/bootstrap.ts` bootstraps AvatarRuntime and MessageRoom only.
- `apps/cli-shell/src/tmux-host.ts` plans and executes tmux sessions.
- `apps/cli-shell/src/run-cli-shell.ts` attaches the selected room/avatar and then starts tmux.
- `apps/cli-shell/src/cleanup.ts` can delete extension-owned tmux sessions and migration residue.
- `apps/cli-shell/test/cli-shell.test.ts` asserts active runtime sources do not publish composed TerminalSystem surfaces or write composed metadata.

In plain terms: the current cli-shell executable no longer creates `terminal-1`
or `terminal-2` as its app UI. The shell pane and room pane are tmux panes.

## Residue Inventory

| Location | Status | Risk | Recommended action |
| --- | --- | --- | --- |
| `apps/cli-shell/legacy/terminal2/**` | Archived old implementation inside the extension package | Medium: it contains old OpenTUI/Web/composed runtime code and can confuse future edits if treated as active | Keep only until this migration is reviewed; delete in a follow-up cleanup once no references remain |
| `apps/cli-shell/legacy/terminal2/test/*.legacy.ts` | Renamed from `.test.ts` so Bun does not treat it as active package tests | Low: useful audit material, but not a contract | Delete with the rest of `legacy/terminal2` after review |
| `apps/cli-shell/experiments/terminal1-framebuffer-experiment.ts` | Experimental terminal-1 framebuffer code | Low: not imported by active runtime | Keep only as experiment; do not use as cli-shell architecture evidence |
| `openspec/specs/cli-shell-app/spec.md` | Durable spec still describes terminal-1/terminal-2 | High: contradicts the new change until archive/spec sync | Replace with tmux-hosted cli-shell law before archiving this change |
| `openspec/specs/terminal-screen-projection-law/spec.md` | Durable spec still defines terminal-2 as final cli-shell app truth | High: stale platform law after this migration | Retire or rewrite the cli-shell-specific projection law before archiving |
| `openspec/specs/terminal-view-component/spec.md` | Mentions backend-authored terminal-2 app truth | Medium: may still be valid for terminal-view experiments, but no longer for cli-shell | Split generic terminal-view law from old cli-shell terminal-2 wording |
| `packages/client-sdk/src/app-runtime.ts` | Still exports `AppTerminalComposedSurfaceState` and helper logic for composed metadata | Medium: generic old API remains available | Do not remove in this change unless all TerminalSystem composed users are retired; mark as non-cli-shell API |
| `packages/client-sdk/src/runtime-store.ts` | Still exposes `publishGlobalTerminalComposedSurface(...)` | Medium: generic old API remains available | Keep for TerminalSystem compatibility; ensure cli-shell active runtime never calls it |
| `packages/app-server/src/app-kernel.ts` and `packages/app-server/src/trpc/router.ts` | Still route composed surface publication to TerminalSystem | Medium: existing TerminalSystem capability, not cli-shell-specific by itself | Keep until a separate TerminalSystem composed-runtime deprecation decision |
| `packages/terminal-system/src/composed-terminal-runtime.ts` and `terminal-control-plane.ts` | Core still has generic composed terminal runtime | Medium: not a cli-shell app law unless reused by cli-shell | Treat as TerminalSystem internal capability; do not couple cli-shell back to it |
| `packages/terminal-system/test/control-plane.test.ts` | Tests generic composed terminal behavior with `shell-*:terminal-2` fixtures | Medium: old fixture names look cli-shell-shaped | Rename fixtures in a follow-up to generic composed-terminal examples if the capability remains |
| `packages/client-sdk/test/app-runtime.test.ts` | Tests old app-extension terminal helpers with `shell-*:terminal-2` fixtures | Medium: stale naming can imply cli-shell ownership | Rename or remove old helper tests when app-extension terminal helpers are deprecated |

## Cleanup Order

1. Keep the active tmux migration and BDD boundary tests in place.
2. Sync durable specs so `cli-shell-app` and related terminal projection laws stop claiming terminal-2 is cli-shell truth.
3. Rename remaining generic TerminalSystem composed tests away from `shell-*:terminal-2`, or explicitly mark them as non-cli-shell TerminalSystem fixtures.
4. Delete `apps/cli-shell/legacy/terminal2/**` after review.
5. Only after no app depends on composed terminal publication, consider deprecating or removing `AppTerminalComposedSurfaceState` and `publishGlobalTerminalComposedSurface(...)`.

## Deletion Risks

- Deleting `apps/cli-shell/legacy/terminal2/**` now is low runtime risk but loses audit material for this review.
- Deleting `publishGlobalTerminalComposedSurface(...)` now is broader TerminalSystem risk because app-server/client-sdk/terminal-system still expose the generic API.
- Leaving stale durable specs unmodified is the highest architecture risk because it makes future agents believe terminal-2 is still the intended cli-shell law.

## Verification Evidence

- `bun run --filter 'agenter-app-shell' test`
- `bun run --filter 'agenter-app-shell' typecheck`
- `bun test packages/cli/test/app-command-launcher.test.ts packages/app-runtime/test/app-runtime.test.ts`
- `openspec validate move-cli-shell-to-extension-tmux-host --strict`

