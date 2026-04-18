import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const jsonNumberSchema = z.number().refine(Number.isFinite, {
  message: "JSON numbers must be finite",
});

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), jsonNumberSchema, z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const authKvKeySchema = z.string().min(1).max(512);

export interface AuthKvFilter {
  keys?: string[];
  prefix?: string;
}

export const authKvFilterSchema = z
  .object({
    keys: z.array(authKvKeySchema).min(1).max(200).optional(),
    prefix: authKvKeySchema.optional(),
  })
  .refine((value) => !(value.keys && value.prefix), {
    message: "keys and prefix are mutually exclusive",
    path: ["keys"],
  });

export interface AuthKvEntry {
  key: string;
  value: JsonValue;
  version: number;
  updatedAt: number;
}

export interface AuthKvSnapshot {
  lastEventId: number;
  items: AuthKvEntry[];
}

export type AuthKvEvent =
  | {
      eventId: number;
      timestamp: number;
      kind: "set";
      entry: AuthKvEntry;
    }
  | {
      eventId: number;
      timestamp: number;
      kind: "delete";
      key: string;
      version: number;
    };

export type AuthKvSetResult =
  | {
      ok: true;
      changed: boolean;
      eventId: number | null;
      entry: AuthKvEntry;
    }
  | {
      ok: false;
      reason: "conflict";
      latest: AuthKvEntry | null;
    };

export type AuthKvDeleteResult =
  | {
      ok: true;
      removed: boolean;
      eventId: number | null;
      key: string;
      version: number | null;
    }
  | {
      ok: false;
      reason: "conflict";
      latest: AuthKvEntry | null;
    };

const normalizeKeys = (keys: readonly string[]): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(key);
  }
  return next;
};

export const normalizeAuthKvFilter = (filter: AuthKvFilter | null | undefined): AuthKvFilter => {
  if (!filter) {
    return {};
  }
  if (filter.keys && filter.prefix) {
    throw new Error("keys and prefix are mutually exclusive");
  }
  return {
    keys: filter.keys ? normalizeKeys(filter.keys) : undefined,
    prefix: filter.prefix,
  };
};

export const matchesAuthKvFilter = (key: string, filter: AuthKvFilter | null | undefined): boolean => {
  const normalized = normalizeAuthKvFilter(filter);
  if (normalized.keys) {
    return normalized.keys.includes(key);
  }
  if (normalized.prefix) {
    return key.startsWith(normalized.prefix);
  }
  return true;
};
