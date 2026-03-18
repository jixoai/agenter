export interface MessageChannelConfig {
  channelId: string;
  displayName: string;
  useAttention: boolean;
}

export interface MessageDraftImageAttachment {
  assetId: string;
  kind: "image";
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface MessageDraft {
  id: string;
  channelId: string;
  content: string;
  timestamp: number;
  meta?: Record<string, string | number | boolean | null>;
  attachments?: MessageDraftImageAttachment[];
}

export interface MessageDiff {
  fromHash: string | null;
  toHash: string | null;
  changed: boolean;
  drafts: MessageDraft[];
}

export interface CommitWaitHandle<T = unknown> {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
}
