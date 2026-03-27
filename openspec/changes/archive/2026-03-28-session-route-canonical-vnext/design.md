## Design

### Platform Rule Update
Session runtime navigation is path-param-first and session-scoped:
- Session identity is derived from route params (`$sessionId`), not search params.
- Workspace identity is derived from session chrome (`session.cwd`), not URL query.

### Route Topology
- Keep global/workspace index routes:
  - `/`
  - `/workspaces`
  - `/settings`
- Session routes only:
  - `/session/$sessionId/chats`
  - `/session/$sessionId/terminals`
  - `/session/$sessionId/settings`
  - `/session/$sessionId/devtools`

### Navigation Contract
- Every session tab jump uses `/session/$sessionId/*`.
- Chats route keeps optional `chatId` as route-local search state.
- Running-session rail selection preserves the active session tab (chats/terminals/settings/devtools).

### Terminal Activity Contract
- Activity rows with structured legacy YAML tool payloads must be promoted to `ToolInvocationCard`, even if they were not persisted as `message/channel=tool` rows.
- Empty call payloads are treated as absent and omitted from visual sections.
