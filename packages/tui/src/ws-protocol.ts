export interface TuiInstanceMeta {
  id: string;
  name: string;
  cwd: string;
  status: string;
}

export interface TuiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type ParsedServerMessage =
  | {
      type: "ack";
      requestId?: string;
      ok: boolean;
      data?: unknown;
      errorMessage?: string;
    }
  | {
      type: "instance.snapshot";
      instances: TuiInstanceMeta[];
    }
  | {
      type: "instance.updated";
      instance: TuiInstanceMeta;
    }
  | {
      type: "instance.deleted";
      instanceId: string;
    }
  | {
      type: "chat.message";
      instanceId: string;
      message: TuiChatMessage;
    };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const parseInstance = (value: unknown): TuiInstanceMeta | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.cwd !== "string" ||
    typeof record.status !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    cwd: record.cwd,
    status: record.status,
  };
};

const parseChatMessage = (value: unknown): TuiChatMessage | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (
    typeof record.id !== "string" ||
    (record.role !== "user" && record.role !== "assistant") ||
    typeof record.content !== "string" ||
    typeof record.timestamp !== "number"
  ) {
    return null;
  }
  return {
    id: record.id,
    role: record.role,
    content: record.content,
    timestamp: record.timestamp,
  };
};

export const parseServerMessage = (input: unknown): ParsedServerMessage | null => {
  const record = asRecord(input);
  if (!record || typeof record.type !== "string") {
    return null;
  }

  if (record.type === "ack") {
    const errorRecord = asRecord(record.error);
    return {
      type: "ack",
      requestId: typeof record.requestId === "string" ? record.requestId : undefined,
      ok: record.ok === true,
      data: record.data,
      errorMessage: typeof errorRecord?.message === "string" ? errorRecord.message : undefined,
    };
  }

  const payload = asRecord(record.payload);
  if (!payload) {
    return null;
  }

  if (record.type === "instance.snapshot") {
    const rawInstances = Array.isArray(payload.instances) ? payload.instances : [];
    return {
      type: "instance.snapshot",
      instances: rawInstances.map(parseInstance).filter((item): item is TuiInstanceMeta => item !== null),
    };
  }

  if (record.type === "instance.updated") {
    const instance = parseInstance(payload.instance);
    return instance ? { type: "instance.updated", instance } : null;
  }

  if (record.type === "instance.deleted") {
    return typeof payload.instanceId === "string" ? { type: "instance.deleted", instanceId: payload.instanceId } : null;
  }

  if (record.type === "chat.message") {
    const message = parseChatMessage(payload.message);
    return typeof payload.instanceId === "string" && message
      ? { type: "chat.message", instanceId: payload.instanceId, message }
      : null;
  }

  return null;
};

