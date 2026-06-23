export const HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE = "agenter:heartbeat-record-select";

export interface HeartbeatRecordSelectMessage {
  type: typeof HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE;
  runtimeId: string;
  recordId: number;
}

const encodePathSegment = (value: string | number): string => encodeURIComponent(String(value));

const appendRefreshParam = (url: string, refreshVersion?: number): string => {
  if (!refreshVersion) {
    return url;
  }
  return `${url}?refresh=${encodeURIComponent(String(refreshVersion))}`;
};

export const buildHeartbeatListAppViewUrl = (runtimeId: string, refreshVersion?: number): string =>
  appendRefreshParam(`/heartbeat-view/${encodePathSegment(runtimeId)}`, refreshVersion);

export const buildHeartbeatDetailAppViewUrl = (input: {
  runtimeId: string;
  recordId: number | null;
  refreshVersion?: number;
}): string => {
  const base = `/heartbeat-view/${encodePathSegment(input.runtimeId)}/records`;
  return appendRefreshParam(
    input.recordId === null ? base : `${base}/${encodePathSegment(input.recordId)}`,
    input.refreshVersion,
  );
};

export const isHeartbeatRecordSelectMessage = (value: unknown): value is HeartbeatRecordSelectMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.type === HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE &&
    typeof record.runtimeId === "string" &&
    typeof record.recordId === "number" &&
    Number.isInteger(record.recordId) &&
    record.recordId > 0
  );
};
