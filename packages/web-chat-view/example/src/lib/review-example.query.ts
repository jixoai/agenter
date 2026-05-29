import type { ReviewProfile, ReviewProfileDraft } from "./review-example.types";

const normalizeAppViewMode = (value: string | null): NonNullable<ReviewProfile["appViewMode"]> =>
  value === "room" ? "room" : "full";

const withAccessToken = (transportUrl: string, accessToken: string): string => {
  const url = new URL(transportUrl);
  url.searchParams.set("token", accessToken);
  return url.toString();
};

export const buildShareQuery = (profile: ReviewProfileDraft): string => {
  const params = new URLSearchParams();
  if (profile.name.trim().length > 0) {
    params.set("name", profile.name.trim());
  }
  params.set("url", profile.transportUrl.trim());
  params.set("token", profile.accessToken.trim());
  params.set("viewer", profile.viewerContactId.trim());
  return params.toString();
};

export const parseImportedProfile = (url: URL): ReviewProfile | null => {
  const appViewMode = normalizeAppViewMode(url.searchParams.get("mode") ?? url.searchParams.get("appViewMode"));
  const rawTransportUrl = url.searchParams.get("url")?.trim() ?? "";
  const accessToken = url.searchParams.get("token")?.trim() ?? "";
  const viewerContactId = url.searchParams.get("viewer")?.trim() ?? "";
  const roomId = url.searchParams.get("room")?.trim() ?? "";
  const transportUrl =
    appViewMode === "room" && rawTransportUrl && accessToken ? withAccessToken(rawTransportUrl, accessToken) : rawTransportUrl;
  if (!transportUrl || !accessToken || !viewerContactId) {
    return null;
  }
  return {
    id: appViewMode === "room" ? "embedded-room-profile" : "imported-profile",
    appViewMode,
    name: url.searchParams.get("name")?.trim() || (roomId ? `Room ${roomId}` : "Imported review room"),
    transportUrl,
    accessToken,
    viewerContactId,
  };
};
