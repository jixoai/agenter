import type { LoopbusTraceInsert, LoopbusTraceRecord, LoopbusTraceStatus, LoopbusTraceUpdate } from "./types";

interface StoredLoopTracePayloadV2 {
  version: 2;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  kind: string;
  name: string;
  refs: LoopbusTraceRecord["refs"];
  links: LoopbusTraceRecord["links"];
  events: LoopbusTraceRecord["events"];
  attributes: LoopbusTraceRecord["attributes"];
  outcome?: LoopbusTraceRecord["outcome"];
}

export interface StoredLoopTraceRow {
  id: number;
  cycle_id: number;
  seq: number;
  step: string;
  status: string;
  started_at: number;
  ended_at: number;
  detail_json: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const isTraceOutcome = (value: unknown): value is NonNullable<LoopbusTraceRecord["outcome"]> => {
  return isRecord(value) && typeof value.code === "string";
};

const normalizeTraceStatus = (status: string): LoopbusTraceStatus => {
  if (status === "running" || status === "done" || status === "error" || status === "cancelled") {
    return status;
  }
  if (status === "ok") {
    return "done";
  }
  return "error";
};

const normalizePayload = (input: LoopbusTraceInsert | LoopbusTraceRecord): StoredLoopTracePayloadV2 => ({
  version: 2,
  traceId: input.traceId,
  spanId: input.spanId,
  parentSpanId: input.parentSpanId ?? null,
  kind: input.kind,
  name: input.name,
  refs: [...(input.refs ?? [])],
  links: [...(input.links ?? [])],
  events: [...(input.events ?? [])],
  attributes: { ...(input.attributes ?? {}) },
  outcome: input.outcome ? { ...input.outcome } : undefined,
});

const deriveLegacyOutcome = (
  status: LoopbusTraceStatus,
  attributes: Record<string, unknown>,
): LoopbusTraceRecord["outcome"] | undefined => {
  if (status === "running") {
    return undefined;
  }
  if (status === "cancelled") {
    return {
      code: "cancelled",
      message: typeof attributes.message === "string" ? attributes.message : undefined,
    };
  }
  if (status === "error") {
    return {
      code: "error",
      message: typeof attributes.message === "string" ? attributes.message : undefined,
      error: attributes,
    };
  }
  return {
    code: "done",
    message: typeof attributes.message === "string" ? attributes.message : undefined,
  };
};

export const encodeLoopTraceRow = (input: LoopbusTraceInsert | LoopbusTraceRecord): { step: string; detailJson: string } => {
  return {
    step: `${input.kind}:${input.name}`,
    detailJson: JSON.stringify(normalizePayload(input)),
  };
};

export const decodeLoopTraceRow = (row: StoredLoopTraceRow): LoopbusTraceRecord => {
  let payload: StoredLoopTracePayloadV2 | null = null;
  try {
    const parsed = JSON.parse(row.detail_json) as unknown;
    if (isRecord(parsed) && parsed.version === 2 && typeof parsed.traceId === "string" && typeof parsed.spanId === "string") {
      payload = {
        version: 2,
        traceId: parsed.traceId,
        spanId: parsed.spanId,
        parentSpanId: typeof parsed.parentSpanId === "string" ? parsed.parentSpanId : null,
        kind: typeof parsed.kind === "string" ? parsed.kind : "legacy.trace",
        name: typeof parsed.name === "string" ? parsed.name : row.step,
        refs: Array.isArray(parsed.refs) ? (parsed.refs as LoopbusTraceRecord["refs"]) : [],
        links: Array.isArray(parsed.links) ? (parsed.links as LoopbusTraceRecord["links"]) : [],
        events: Array.isArray(parsed.events) ? (parsed.events as LoopbusTraceRecord["events"]) : [],
        attributes: isRecord(parsed.attributes) ? parsed.attributes : {},
        outcome: isTraceOutcome(parsed.outcome) ? parsed.outcome : undefined,
      };
    }
  } catch {
    payload = null;
  }

  const normalizedStatus = normalizeTraceStatus(row.status);
  if (payload) {
    return {
      id: row.id,
      cycleId: row.cycle_id,
      seq: row.seq,
      traceId: payload.traceId,
      spanId: payload.spanId,
      parentSpanId: payload.parentSpanId ?? undefined,
      kind: payload.kind,
      name: payload.name,
      status: normalizedStatus,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      refs: payload.refs,
      links: payload.links,
      events: payload.events,
      attributes: payload.attributes,
      outcome: payload.outcome,
    };
  }

  let attributes: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.detail_json) as unknown;
    attributes = isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    attributes = {};
  }

  return {
    id: row.id,
    cycleId: row.cycle_id,
    seq: row.seq,
    traceId: `legacy-trace-${row.cycle_id}`,
    spanId: `legacy-span-${row.id}`,
    parentSpanId: undefined,
    kind: "legacy.trace",
    name: row.step,
    status: normalizedStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    refs: [],
    links: [],
    events: [],
    attributes,
    outcome: deriveLegacyOutcome(normalizedStatus, attributes),
  };
};

export const mergeLoopTraceRecord = (current: LoopbusTraceRecord, input: LoopbusTraceUpdate): LoopbusTraceRecord => ({
  ...current,
  parentSpanId: input.parentSpanId !== undefined ? input.parentSpanId : current.parentSpanId,
  status: input.status ?? current.status,
  endedAt: input.endedAt ?? current.endedAt,
  refs: input.refs ? [...input.refs] : current.refs,
  links: input.links ? [...input.links] : current.links,
  events: input.events ? [...input.events] : current.events,
  attributes: input.attributes ? { ...input.attributes } : current.attributes,
  outcome: input.outcome !== undefined ? (input.outcome ? { ...input.outcome } : undefined) : current.outcome,
});
