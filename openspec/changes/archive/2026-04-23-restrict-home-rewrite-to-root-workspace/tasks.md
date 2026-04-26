## 1. Runtime environment profiles

- [x] 1.1 Split runtime environment assembly into explicit `root-workspace`, `public-workspace`, and shared-terminal collaboration profiles instead of reusing one root-oriented helper everywhere.
- [x] 1.2 Keep `root_bash` on the `root-workspace` profile so it still rewrites `HOME` to the avatar root workspace and mounts root-exclusive runtime CLI/env.
- [x] 1.3 Keep `workspace_bash` on the `public-workspace` profile so it stays env-pass-through, does not synthesize avatar-root `HOME`, and does not mount root-workspace-exclusive CLI helpers.
- [x] 1.4 Move terminal create/recovery onto the shared-terminal collaboration profile so shared terminals keep real-home semantics and do not inherit root-workspace-exclusive CLI/env by default.
- [x] 1.5 Update runtime code comments, tool descriptions, and nearby naming to make `root-workspace` versus `public-workspace` semantics explicit.

## 2. Contract tests

- [x] 2.1 Add runtime tests that prove `root_bash` keeps `HOME=<rootWorkspacePath>`.
- [x] 2.2 Add runtime shell tests that prove `workspace_bash` does not gain root-workspace-exclusive CLI/env by default.
- [x] 2.3 Add runtime terminal tests that prove terminal create and terminal recovery do not rewrite `HOME` to the avatar root workspace and do not inject root-workspace-exclusive CLI/env by default.
- [x] 2.4 Add coverage showing a shared terminal started inside the avatar-root cwd still preserves shared-terminal collaboration semantics.

## 3. Workspace UI contract

- [x] 3.1 Update the workspace workbench contract and implementation so the page explicitly distinguishes `root-workspace` versus `public-workspace`.
- [x] 3.2 Ensure the UI copy explains the distinction as env/CLI semantics rather than as a hard “root-workspace cannot be shared” rule.
- [x] 3.3 Add workspace UI tests or stories that cover the root/public distinction on both desktop and compact layouts.

## 4. Guidance and durable law sync

- [x] 4.1 Update runtime shell guidance and any helper/docs that currently imply root-workspace-exclusive env/CLI are available on shared surfaces.
- [x] 4.2 Sync durable specs or package-level specs that describe runtime shell / terminal / workspace law so they match the new root-only env/CLI rule before the change is archived.
