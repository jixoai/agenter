import { del, get, set } from "idb-keyval";

import type { ReviewProfile } from "./review-example.types";

const STORAGE_KEY = "web-chat-view-review-shell:profiles:v1";

export const loadStoredProfiles = async (): Promise<ReviewProfile[]> => {
  const value = await get<unknown>(STORAGE_KEY);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isReviewProfile);
};

export const saveStoredProfiles = async (profiles: readonly ReviewProfile[]): Promise<void> => {
  await set(STORAGE_KEY, profiles);
};

export const clearStoredProfiles = async (): Promise<void> => {
  await del(STORAGE_KEY);
};

const isReviewProfile = (value: unknown): value is ReviewProfile => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ReviewProfile>;
	return (
		typeof candidate.id === "string" &&
		typeof candidate.name === "string" &&
		typeof candidate.transportUrl === "string" &&
		typeof candidate.accessToken === "string" &&
		typeof candidate.viewerContactId === "string"
	);
};
