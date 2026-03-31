## 1. Navigation and global workspace model

- [x] 1.1 Replace the standalone `Quick Start` and `GlobalSettings` primary-route assumptions with `Chats / Terminals / Workspaces`.
- [x] 1.2 Define `~/` as the special global workspace and formalize fixed `Welcome` and `History` entries inside `Workspaces`.
- [x] 1.3 Update secondary navigation from `Running Sessions` to `Running Avatars` across desktop and compact layouts.

## 2. Settings and avatar hierarchy

- [x] 2.1 Define default global-workspace inheritance for regular workspaces and keep one shared workspace-settings API shape.
- [x] 2.2 Define shared versus local settings persistence boundaries for global/workspace settings, private secrets, and avatar-local room/terminal credentials.
- [x] 2.3 Define global/workspace avatar catalogs, the `default` avatar contract, copy-based forking, and session uniqueness by `workspace + avatar`.

## 3. Welcome orchestration and runtime shell

- [x] 3.1 Define the Welcome start orchestrator for avatar selection, global room/terminal references, role/grant intent, and `credential-invalid` access state.
- [x] 3.2 Define draft-preservation behavior when the user detours into `Chats` or `Terminals` and then returns to `Welcome`.
- [x] 3.3 Define running-avatar detail shell behavior, including default `Attention`, flat runtime tabs, `Cycles` badge state, and link-out to global resource pages.

## 4. Client state and source navigation verification

- [x] 4.1 Update client-runtime-store contracts for resource-first normalization, avatar-local credential validation state, and orchestration draft retention.
- [x] 4.2 Define attention source navigation for room and terminal origins, including unavailable-source states.
- [x] 4.3 Add app-server, client-store, DOM, and browser verification coverage for global workspace, Welcome orchestration, running avatars, and source jump behavior.
