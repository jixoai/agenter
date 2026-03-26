export type LongListResource =
  | "chat"
  | "cycles"
  | "observability-trace"
  | "model-calls"
  | "api-calls"
  | "terminal-activity";

export interface LongListPagingInput {
  resource: LongListResource;
  sessionId: string;
  detailId?: string | null;
}

export interface LongListPagingState {
  hydrated: boolean;
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
}

export const DEFAULT_LONG_LIST_PAGING_STATE: LongListPagingState = {
  hydrated: false,
  hasMore: true,
  loading: false,
  loadingOlder: false,
};

export const resolveLongListPagingKey = (input: LongListPagingInput): string => {
  return input.detailId
    ? `${input.resource}:${input.sessionId}:${input.detailId}`
    : `${input.resource}:${input.sessionId}`;
};
