import type { AgenterSettings, SettingsGraphLayer, SettingsProvenanceEntry, SettingsProvenanceOrigin } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const escapePointerToken = (token: string): string => token.replaceAll("~", "~0").replaceAll("/", "~1");

const decodePointerToken = (token: string): string => token.replaceAll("~1", "/").replaceAll("~0", "~");

const buildPointer = (base: string, token: string): string => (base.length === 0 ? `/${escapePointerToken(token)}` : `${base}/${escapePointerToken(token)}`);

const valuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!valuesEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!valuesEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
};

const collectNodePointersInternal = (value: unknown, pointer: string, output: Set<string>): void => {
  output.add(pointer);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectNodePointersInternal(value[index], buildPointer(pointer, String(index)), output);
    }
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectNodePointersInternal(child, buildPointer(pointer, key), output);
  }
};

const collectChangedPointersInternal = (before: unknown, after: unknown, pointer: string, output: Set<string>): void => {
  if (valuesEqual(before, after)) {
    return;
  }
  output.add(pointer);

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let index = 0; index < max; index += 1) {
      collectChangedPointersInternal(before[index], after[index], buildPointer(pointer, String(index)), output);
    }
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      collectChangedPointersInternal(before[key], after[key], buildPointer(pointer, key), output);
    }
  }
};

export const collectNodePointers = (value: unknown): string[] => {
  const pointers = new Set<string>();
  collectNodePointersInternal(value, "", pointers);
  return [...pointers];
};

export const collectChangedPointers = (before: unknown, after: unknown): string[] => {
  const pointers = new Set<string>();
  collectChangedPointersInternal(before, after, "", pointers);
  return [...pointers];
};

export const readPointerValue = (value: unknown, pointer: string): unknown => {
  if (pointer.length === 0) {
    return value;
  }
  const tokens = pointer
    .split("/")
    .slice(1)
    .map((token) => decodePointerToken(token));
  let cursor: unknown = value;
  for (const token of tokens) {
    if (Array.isArray(cursor)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0) {
        return undefined;
      }
      cursor = cursor[index];
      continue;
    }
    if (!isPlainObject(cursor)) {
      return undefined;
    }
    cursor = cursor[token];
  }
  return cursor;
};

export const createLayerId = (kind: SettingsGraphLayer["kind"], sourceId: string, index: number): string =>
  `${kind}:${sourceId}:${index}`;

export const recordLayerProvenance = (input: {
  provenance: Map<string, SettingsProvenanceEntry>;
  pointers: string[];
  after: AgenterSettings;
  layer: SettingsGraphLayer;
  note?: string;
}): void => {
  const pointerSet = new Set(input.pointers);
  for (const pointer of pointerSet) {
    const origin: SettingsProvenanceOrigin = {
      layerId: input.layer.layerId,
      sourceId: input.layer.sourceId,
      kind: input.layer.kind,
      path: input.layer.path,
      pointer,
      value: readPointerValue(input.after, pointer),
      note: input.note,
    };
    const existing = input.provenance.get(pointer);
    if (!existing) {
      input.provenance.set(pointer, {
        pointer,
        origins: [origin],
      });
      continue;
    }
    existing.origins.push(origin);
  }
};

export const toProvenanceObject = (
  provenance: Map<string, SettingsProvenanceEntry>,
): Record<string, SettingsProvenanceEntry> => {
  const entries = [...provenance.entries()].sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
};
