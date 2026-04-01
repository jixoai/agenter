import type { RuntimeStore } from "@agenter/client-sdk";
import { useMemo } from "react";

type IconRuntimeStore = Pick<RuntimeStore, "profileIconUrl" | "sessionIconUrl">;

const normalizeReference = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export interface IconServiceUrls {
  profile: (reference: string | null | undefined) => string | null;
  session: (sessionId: string | null | undefined) => string | null;
}

export const createIconServiceUrls = (runtimeStore: IconRuntimeStore): IconServiceUrls => ({
  profile: (reference) => {
    const normalized = normalizeReference(reference);
    return normalized ? runtimeStore.profileIconUrl(normalized) : null;
  },
  session: (sessionId) => {
    const normalized = normalizeReference(sessionId);
    return normalized ? runtimeStore.sessionIconUrl(normalized) : null;
  },
});

export const useIconServiceUrls = (runtimeStore: IconRuntimeStore): IconServiceUrls =>
  useMemo(() => createIconServiceUrls(runtimeStore), [runtimeStore]);
