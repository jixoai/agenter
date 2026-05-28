import type { WebChatActorPresentation } from "@agenter/web-chat-view";

import type { ReviewChannelEnvelope } from "./review-example.types";

export const resolveActorPresentation = (
  actorDirectory: ReviewChannelEnvelope["actorDirectory"],
): ((input: { actorId?: string | null; fallbackLabel: string }) => WebChatActorPresentation | null) => {
  return (input) => {
    const actorId = input.actorId ?? null;
    if (!actorId) {
      return {
        label: input.fallbackLabel,
      };
    }
    return actorDirectory[actorId] ?? { actorId, label: input.fallbackLabel };
  };
};
