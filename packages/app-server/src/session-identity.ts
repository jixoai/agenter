import { resolveAvatarRuntimeId } from "./avatar-runtime-id";

export const resolveWorkspaceAvatarSessionId = (_workspacePath: string, avatar: string): string => {
  return resolveAvatarRuntimeId(avatar);
};
