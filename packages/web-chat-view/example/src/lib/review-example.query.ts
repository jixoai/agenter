import type { ReviewProfile, ReviewProfileDraft } from "./review-example.types";

export const buildShareQuery = (profile: ReviewProfileDraft): string => {
  const params = new URLSearchParams();
  if (profile.name.trim().length > 0) {
    params.set("name", profile.name.trim());
  }
  params.set("url", profile.transportUrl.trim());
  params.set("token", profile.accessToken.trim());
  params.set("viewerActorId", profile.viewerActorId.trim());
  return params.toString();
};

export const parseImportedProfile = (url: URL): ReviewProfile | null => {
  const transportUrl = url.searchParams.get("url")?.trim() ?? "";
  const accessToken = url.searchParams.get("token")?.trim() ?? "";
  const viewerActorId = url.searchParams.get("viewerActorId")?.trim() ?? "";
  if (!transportUrl || !accessToken || !viewerActorId) {
    return null;
  }
  return {
    id: "imported-profile",
    name: url.searchParams.get("name")?.trim() || "Imported review room",
    transportUrl,
    accessToken,
    viewerActorId,
  };
};
