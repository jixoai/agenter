export interface ChatRecord {
  id: number;
  content: string;
  from: string;
  score: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAddInput {
  content: string;
  from: string;
  score?: number;
  remark?: string;
}

export interface ChatRemarkInput {
  id: number;
  score?: number;
  remark?: string;
}

export interface ChatQueryInput {
  offset?: number;
  limit?: number;
  query?: string;
  includeInactive?: boolean;
}

export interface ChatReplyRelationship {
  id: number;
  score?: number;
  remark?: string;
}

export interface ChatReplyInput {
  replyContent: string;
  from?: string;
  score?: number;
  relationships?: ChatReplyRelationship[];
}

export interface ChatReplyResult {
  reply: ChatRecord;
  related: ChatRecord[];
}

export interface ChatSystemSnapshot {
  nextId: number;
  records: ChatRecord[];
}
