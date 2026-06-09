export const HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE = "agenter:heartbeat-record-select";

export interface HeartbeatRecordSelectMessage {
  type: typeof HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE;
  runtimeId: string;
  recordId: number;
}

const encodePathSegment = (value: string | number): string => encodeURIComponent(String(value));

export const buildHeartbeatListAppViewUrl = (runtimeId: string): string =>
  `/heartbeat-view/${encodePathSegment(runtimeId)}`;

export const buildHeartbeatDetailAppViewUrl = (input: { runtimeId: string; recordId: number | null }): string => {
  const base = `/heartbeat-view/${encodePathSegment(input.runtimeId)}/records`;
  return input.recordId === null ? base : `${base}/${encodePathSegment(input.recordId)}`;
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
