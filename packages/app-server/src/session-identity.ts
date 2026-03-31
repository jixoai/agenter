import { createHash } from "node:crypto";

import { toWorkspacePath } from "./workspace-target";

export const resolveWorkspaceAvatarSessionId = (workspacePath: string, avatar: string): string => {
  const digest = createHash("sha1").update(`agenter-session:${toWorkspacePath(workspacePath)}\u0000${avatar}`).digest();
  const bytes = Uint8Array.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};
