## Context

Workspace avatar catalogs currently come from direct route queries. That means the store has no durable view of which workspace avatar catalogs are active, and the UI cannot reconcile copy mutations with external file changes under `.agenter/avatar`.

## Goals / Non-Goals

**Goals:**
- Normalize workspace avatar catalogs in `RuntimeStore`
- Reflect copy/fork results immediately in the Svelte `Workspaces` route
- Push catalog changes caused by filesystem updates back to the browser

**Non-Goals:**
- Introduce avatar inheritance overlays or `extends`
- Change the deterministic session identity rules for `workspace + avatar`
- Build a full avatar editor in this change

## Decisions

### Treat avatar catalogs as subscribable workspace resources
The client store will keep `workspaceAvatarCatalogByPath` and expose explicit watch/hydrate helpers for the currently inspected workspace. This keeps avatar catalog truth close to other global resources.

### Use optimistic copy plus server reconciliation
Copying an avatar will insert a temporary optimistic entry into the catalog, immediately switch the selected avatar to it, and then reconcile with the server response and any subsequent watcher event.

### Watch workspace and global avatar roots on the server
The backend will watch the relevant avatar directories and emit catalog invalidation events for affected workspaces. UI-triggered mutations and external filesystem edits will converge through the same path.

## Risks / Trade-offs

- [Risk] Filesystem watchers can be noisy during rapid avatar edits. -> Mitigation: debounce invalidation and rebuild per workspace root.
- [Risk] Optimistic entries could diverge if server normalization changes the nickname. -> Mitigation: reconcile by normalized nickname from the mutation response.
- [Risk] Watching too many workspaces can become expensive. -> Mitigation: only watch active workspace/global avatar roots referenced by connected clients or recently mutated workspaces.
