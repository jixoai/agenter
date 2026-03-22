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
  minScore?: number;
}

export interface AttentionUpdateRelationship {
  id: number;
  score?: number;
  remark?: string;
}

export interface AttentionUpdateInput {
  content: string;
  from?: string;
  score?: number;
  relationships?: AttentionUpdateRelationship[];
}

export interface AttentionUpdateResult {
  record: AttentionRecord;
  related: AttentionRecord[];
}

export interface AttentionSystemSnapshot {
  nextId: number;
  records: AttentionRecord[];
}
