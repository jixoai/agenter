## Context

The terminal control plane already exposes durable terminal facts and internal listeners for snapshots, status changes, focus, and approval requests. The active Svelte route does not consume those facts as a live system surface; instead it re-queries on a timer and reconstructs a thin page-local state model.

## Goals / Non-Goals

**Goals:**
- Make terminal-system a subscription-backed global surface
- Preserve refresh-safe terminal metadata and activity evidence
- Align the right sidebar and access-management UX with the message-system operator patterns

**Non-Goals:**
- Replace `@agenter/terminal-view`
- Change terminal-system authority, grant, or approval semantics
- Build task-system controls into the terminal route

## Decisions

### Reuse terminal control plane listeners through app-server subscriptions
The server will expose terminal live events derived from the existing control plane listeners instead of inventing a second polling protocol.

### Normalize terminal resources in the client store
The store will own global terminal catalog entries, activity streams, grant lists, approval lists, and seat projections keyed by terminal id. The route becomes a selector-driven projection.

### Keep terminal rendering and operator chrome separate
`terminal-view` remains the transcript/rendering primitive. The Svelte route owns the `Actions + Users` sidebar, access-management dialogs, `call as` state, and tool-call forms.

## Risks / Trade-offs

- [Risk] Terminal events can be high-frequency and overwhelm the route if applied directly. -> Mitigation: normalize by terminal id and coalesce snapshot/status updates in the store.
- [Risk] Grant and approval updates can race with call-as UI. -> Mitigation: route all changes through store state so selectors update in one render path.
- [Risk] Actions rendering could drift from the message-system visual grammar. -> Mitigation: share operator affordance patterns and add Storybook DOM coverage for both surfaces.
