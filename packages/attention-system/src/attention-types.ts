export interface AttentionRecord {
  id: number;
  content: string;
  from: string;
  score: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionAddInput {
  content: string;
  from: string;
  score?: number;
  remark?: string;
}

export interface AttentionRemarkInput {
  id: number;
  score?: number;
  remark?: string;
}

export interface AttentionQueryInput {
  offset?: number;
  limit?: number;
  query?: string;
  includeInactive?: boolean;
}

export interface AttentionReplyRelationship {
  id: number;
  score?: number;
  remark?: string;
}

export interface AttentionReplyInput {
  replyContent: string;
  from?: string;
  score?: number;
  relationships?: AttentionReplyRelationship[];
}

export interface AttentionReplyResult {
  reply: AttentionRecord;
  related: AttentionRecord[];
}

export interface AttentionSystemSnapshot {
  nextId: number;
  records: AttentionRecord[];
}
