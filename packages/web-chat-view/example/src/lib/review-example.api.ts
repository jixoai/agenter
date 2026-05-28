import type { MessageAttachment } from "@agenter/message-system";
import {
  type WebChatComposerSubmitPayload,
} from "@agenter/web-chat-view";

import type {
  ReviewAssetUploadResponse,
  ReviewChannelEnvelope,
  ReviewPeopleEnvelope,
  ReviewProfile,
  ReviewSendResponse,
} from "./review-example.types";

export const fetchReviewChannel = async (profile: ReviewProfile): Promise<ReviewChannelEnvelope> => {
  const response = await fetch(buildApiUrl(`/api/review/channel?${new URLSearchParams({
    transportUrl: profile.transportUrl,
    accessToken: profile.accessToken,
    viewerActorId: profile.viewerActorId,
  }).toString()}`));
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return normalizeReviewChannelEnvelope(await response.json());
};

export const fetchReviewPeople = async (profile: ReviewProfile): Promise<ReviewPeopleEnvelope> => {
  const response = await fetch(
    buildApiUrl(
      `/api/review/people?${new URLSearchParams({
        viewerActorId: profile.viewerActorId,
      }).toString()}`,
    ),
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return normalizeReviewPeopleEnvelope(await response.json());
};

export const submitReviewMessage = async (
  profile: ReviewProfile,
  payload: WebChatComposerSubmitPayload,
): Promise<ReviewSendResponse> => {
  const attachments = payload.assets.length > 0 ? await uploadReviewAssets(profile, payload.assets) : [];
  const response = await fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(resolveChatId(profile.transportUrl))}/messages`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agenter-room-access-token": profile.accessToken,
    },
    body: JSON.stringify({
      content: payload.text.trim(),
      attachments,
      senderContactId: profile.viewerActorId,
      metadata:
        (payload.commentResources?.length ?? 0) > 0
          ? {
              webChatCommentResources: payload.commentResources,
            }
          : undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as ReviewSendResponse;
};

const uploadReviewAssets = async (profile: ReviewProfile, files: readonly File[]): Promise<MessageAttachment[]> => {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const response = await fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(resolveChatId(profile.transportUrl))}/assets`), {
    method: "POST",
    headers: {
      "x-agenter-room-access-token": profile.accessToken,
    },
    body: form,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as ReviewAssetUploadResponse;
  return data.items;
};

const resolveChatId = (transportUrl: string): string => {
  const url = new URL(transportUrl);
  const match = url.pathname.match(/\/room\/([^/]+)$/u);
  if (!match?.[1]) {
    throw new Error("transport URL must include /room/<chatId>");
  }
  return decodeURIComponent(match[1]);
};

const buildApiUrl = (path: string): string => path;

const normalizeReviewChannelEnvelope = (value: unknown): ReviewChannelEnvelope => {
  if (!value || typeof value !== "object") {
    throw new Error("review channel payload must be an object");
  }
  const candidate = value as Partial<ReviewChannelEnvelope>;
  if (!candidate.channel || typeof candidate.channel !== "object") {
    throw new Error("review channel payload is missing channel");
  }
  return {
    channel: candidate.channel,
    initialMessages: Array.isArray(candidate.initialMessages) ? candidate.initialMessages : [],
    actorDirectory:
      candidate.actorDirectory && typeof candidate.actorDirectory === "object" ? candidate.actorDirectory : {},
    resourceReferences: Array.isArray(candidate.resourceReferences) ? candidate.resourceReferences : [],
  };
};

const normalizeReviewPeopleEnvelope = (value: unknown): ReviewPeopleEnvelope => {
  if (!value || typeof value !== "object") {
    throw new Error("review people payload must be an object");
  }
  const candidate = value as Partial<ReviewPeopleEnvelope>;
  if (!candidate.currentActor || typeof candidate.currentActor !== "object") {
    throw new Error("review people payload is missing currentActor");
  }
  return {
    currentActor: candidate.currentActor,
    sources: Array.isArray(candidate.sources) ? candidate.sources : [],
    contacts: Array.isArray(candidate.contacts) ? candidate.contacts : [],
    contactRequests: Array.isArray(candidate.contactRequests) ? candidate.contactRequests : [],
  };
};

const readError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // ignore
  }
  return `${response.status} ${response.statusText}`;
};
