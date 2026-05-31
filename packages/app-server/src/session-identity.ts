import { resolveAvatarRuntimeId } from "./avatar-runtime-id";

export const resolveAvatarSessionId = (avatar: string): string => {
  return resolveAvatarRuntimeId(avatar);
};
