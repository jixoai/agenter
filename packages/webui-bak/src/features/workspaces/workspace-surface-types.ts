export type WorkspaceMasterSelection =
  | { kind: "welcome" }
  | { kind: "history" }
  | { kind: "workspace"; workspacePath: string };

export type WorkspaceDetailTab = "settings" | "avatars";
export type WorkspaceHistorySortMode = "recent" | "path" | "name";
