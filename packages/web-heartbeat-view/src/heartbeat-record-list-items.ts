import type { HeartbeatRecordItem } from "./types";

export type HeartbeatRecordListItem =
  | { kind: "date-divider"; date: string }
  | { kind: "record"; record: HeartbeatRecordItem };

export const formatHeartbeatRecordDate = (startedAt: number): string => new Date(startedAt).toISOString().slice(0, 10);

export const buildHeartbeatRecordListItems = (records: readonly HeartbeatRecordItem[]): HeartbeatRecordListItem[] => {
  const items: HeartbeatRecordListItem[] = [];
  let previousDate: string | null = null;
  for (const record of records) {
    const date = formatHeartbeatRecordDate(record.startedAt);
    if (date !== previousDate) {
      items.push({ kind: "date-divider", date });
      previousDate = date;
    }
    items.push({ kind: "record", record });
  }
  return items;
};
