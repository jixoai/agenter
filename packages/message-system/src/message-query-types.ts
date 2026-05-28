import type { MessageContactId, MessageRecord } from "./types";

export type MessageQueryChatScope = string | string[] | "*";
export type MessageQueryMode = "match" | "query" | "sql";

export interface MessageQueryRequest {
  chatId: MessageQueryChatScope;
  mode: MessageQueryMode;
  query: string;
  offset?: number;
  limit?: number;
}

export interface MessageAuthorizedQueryInput extends MessageQueryRequest {
  accessToken?: string;
  contactId?: MessageContactId;
  superadminContactId?: MessageContactId;
}

export interface MessageQueryHit {
  chatId: string;
  chatTitle?: string;
  contextId?: string;
  score?: number;
  message: MessageRecord;
}

export interface MessageQueryPage {
  mode: MessageQueryMode;
  chatIds: string[];
  offset: number;
  limit: number;
  nextOffset: number | null;
  hasMore: boolean;
}

export interface MessageQueryMessageResult extends MessageQueryPage {
  resultKind: "messages";
  items: MessageQueryHit[];
}

export type MessageQueryScalar = string | number | null;

export interface MessageQuerySqlResult extends MessageQueryPage {
  resultKind: "sql";
  columns: string[];
  rows: Array<Record<string, MessageQueryScalar>>;
}

export type MessageQueryResult = MessageQueryMessageResult | MessageQuerySqlResult;
