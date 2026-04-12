import type { WorkspaceMode } from "./workspace-workbench-state";

export const WORKSPACE_AVATAR_QUERY_PARAM = "avatar";
export const WORKSPACE_MODE_QUERY_PARAM = "mode";
export const WORKSPACE_SEARCH_QUERY_PARAM = "q";

const normalizeNonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeWorkspaceModeQuery = (value: WorkspaceMode | string | null | undefined): WorkspaceMode | null => {
  if (value === "explorer" || value === "rules" || value === "private") {
    return value;
  }
  return null;
};

export const readWorkspaceAvatar = (searchParams: URLSearchParams): string | null =>
  normalizeNonEmpty(searchParams.get(WORKSPACE_AVATAR_QUERY_PARAM));

export const buildWorkspaceIndexHref = (input: { avatar?: string | null } = {}): string => {
  const params = new URLSearchParams();
  const avatar = normalizeNonEmpty(input.avatar);
  if (avatar) {
    params.set(WORKSPACE_AVATAR_QUERY_PARAM, avatar);
  }
  const search = params.toString();
  return search.length > 0 ? `/workspaces?${search}` : "/workspaces";
};

export const buildWorkspaceDetailHref = (input: {
  workspacePath: string;
  avatar?: string | null;
  mode?: WorkspaceMode | string | null;
  q?: string | null;
}): string => {
  const pathname = `/workspaces/root/${encodeURIComponent(input.workspacePath)}`;
  const params = new URLSearchParams();
  const avatar = normalizeNonEmpty(input.avatar);
  const mode = normalizeWorkspaceModeQuery(input.mode);
  const query = normalizeNonEmpty(input.q);

  if (avatar) {
    params.set(WORKSPACE_AVATAR_QUERY_PARAM, avatar);
  }
  if (mode && mode !== "explorer") {
    params.set(WORKSPACE_MODE_QUERY_PARAM, mode);
  }
  if (query) {
    params.set(WORKSPACE_SEARCH_QUERY_PARAM, query);
  }

  const search = params.toString();
  return search.length > 0 ? `${pathname}?${search}` : pathname;
};
