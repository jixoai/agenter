import type {
  MessageAttachment,
  MessageContactRecord,
  MessageContactRequestRecord,
  MessageControlPlaneEntry,
  MessageRecord,
  MessageSourceSubscriptionRecord,
} from "@agenter/message-system";
import type { WebChatActorPresentation, WebChatResourceReference } from "@agenter/web-chat-view";

export interface ReviewProfile {
  id: string;
  name: string;
  transportUrl: string;
  accessToken: string;
  viewerActorId: string;
}

export interface ReviewProfileDraft {
  name: string;
  transportUrl: string;
  accessToken: string;
  viewerActorId: string;
}

export interface ReviewBootstrapPayload {
  profiles: ReviewProfile[];
  recommendedProfileId: string | null;
}

export interface ReviewChannelEnvelope {
  channel: MessageControlPlaneEntry;
  initialMessages: MessageRecord[];
  actorDirectory: Record<string, WebChatActorPresentation>;
  resourceReferences?: readonly WebChatResourceReference[];
}

export interface ReviewActorProfile {
  actorId: string;
  label: string;
  iconUrl?: string;
}

export interface ReviewPeopleEnvelope {
  currentActor: ReviewActorProfile;
  sources: MessageSourceSubscriptionRecord[];
  contacts: MessageContactRecord[];
  contactRequests: MessageContactRequestRecord[];
}

export interface ReviewSendResponse {
  ok: true;
}

export interface ReviewAssetUploadResponse {
  ok: true;
  items: MessageAttachment[];
}
