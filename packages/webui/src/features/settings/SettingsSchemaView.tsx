import { useEffect, useRef, type ReactNode } from "react";

import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { getValueAtPointer, patchValueAtPointer } from "./settings-json-pointer";
import type { SettingsPointerJumpTarget, SettingsProvenanceEntry } from "./settings-graph-types";

interface SettingsSchemaViewProps {
  schema: Record<string, unknown> | null;
  value: unknown;
  mode: "readonly" | "editable";
  provenance?: Record<string, SettingsProvenanceEntry>;
  focusPointer?: string | null;
  onValueChange?: (nextValue: unknown) => void;
  onJumpToSource?: (target: SettingsPointerJumpTarget) => void;
}

type SchemaKind = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null" | "unknown";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPrimitive = (value: unknown): value is string | number | boolean | null =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const isSchemaRecord = (value: unknown): value is Record<string, unknown> => isRecord(value);

const asSchemaRecord = (value: unknown): Record<string, unknown> | null => (isSchemaRecord(value) ? value : null);

const asSchemaList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map((item) => asSchemaRecord(item)).filter((item): item is Record<string, unknown> => item !== null) : [];

const toSchemaKind = (schema: Record<string, unknown> | null, value: unknown): SchemaKind => {
  const rawType = schema?.type;
  if (typeof rawType === "string") {
    if (rawType === "object" || rawType === "array" || rawType === "string" || rawType === "number" || rawType === "integer" || rawType === "boolean" || rawType === "null") {
      return rawType;
    }
  }
  if (schema?.properties || schema?.additionalProperties) {
    return "object";
  }
  if (schema?.items) {
    return "array";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (isRecord(value)) {
    return "object";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value;
  }
  return "unknown";
};

const pickUnionSchema = (schema: Record<string, unknown> | null, value: unknown): Record<string, unknown> | null => {
  if (!schema) {
    return null;
  }
  const unions = [...asSchemaList(schema.anyOf), ...asSchemaList(schema.oneOf)];
  if (unions.length === 0) {
    return schema;
  }
  const matched = unions.find((item) => toSchemaKind(item, value) === toSchemaKind(schema, value));
  return matched ?? unions[0] ?? schema;
};

const getChildSchema = (schema: Record<string, unknown> | null, token: string, value: unknown): Record<string, unknown> | null => {
  const normalized = pickUnionSchema(schema, value);
  if (!normalized) {
    return null;
  }
  const kind = toSchemaKind(normalized, value);
  if (kind === "object") {
    const properties = asSchemaRecord(normalized.properties);
    if (properties && asSchemaRecord(properties[token])) {
      return asSchemaRecord(properties[token]);
    }
    const additional = asSchemaRecord(normalized.additionalProperties);
    return additional;
  }
  if (kind === "array") {
    return asSchemaRecord(normalized.items);
  }
  return null;
};

const shortPath = (path: string): string => {
  if (path.length <= 42) {
    return path;
  }
  return `...${path.slice(-39)}`;
};

const renderPrimitive = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
};

const readEnumValues = (schema: Record<string, unknown> | null): Array<string | number | boolean> => {
  if (!schema || !Array.isArray(schema.enum)) {
    return [];
  }
  return schema.enum.filter((item): item is string | number | boolean => typeof item === "string" || typeof item === "number" || typeof item === "boolean");
};

const FieldProvenance = ({
  entry,
  onJumpToSource,
}: {
  entry: SettingsProvenanceEntry | undefined;
  onJumpToSource?: (target: SettingsPointerJumpTarget) => void;
}) => {
  const origin = entry?.origins.at(-1);
  if (!origin) {
    return null;
  }
  const label = origin.note ?? origin.path;
  if (entry?.jumpTarget && onJumpToSource) {
    return (
      <button
        type="button"
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
        onClick={() => onJumpToSource(entry.jumpTarget!)}
      >
        {shortPath(label)}
      </button>
    );
  }
  return <span className="text-[10px] text-slate-500">{shortPath(label)}</span>;
};

interface FieldNodeProps {
  label: string;
  pointer: string;
  schema: Record<string, unknown> | null;
  value: unknown;
  mode: "readonly" | "editable";
  provenance?: Record<string, SettingsProvenanceEntry>;
  focusPointer?: string | null;
  onPatch?: (pointer: string, nextValue: unknown) => void;
  onJumpToSource?: (target: SettingsPointerJumpTarget) => void;
  registerPointer: (pointer: string, element: HTMLElement | null) => void;
}

const FieldNode = ({
  label,
  pointer,
  schema,
  value,
  mode,
  provenance,
  focusPointer,
  onPatch,
  onJumpToSource,
  registerPointer,
}: FieldNodeProps) => {
  const entry = provenance?.[pointer];
  const normalizedSchema = pickUnionSchema(schema, value);
  const enumValues = readEnumValues(normalizedSchema);
  const kind = toSchemaKind(normalizedSchema, value);
  const focused = focusPointer === pointer;
  const scalarEditable = mode === "editable" && onPatch && (kind === "string" || kind === "number" || kind === "integer" || kind === "boolean");

  let body: ReactNode = null;

  if (kind === "object") {
    const record = isRecord(value) ? value : {};
    const schemaProps = asSchemaRecord(normalizedSchema?.properties);
    const keys = new Set<string>([...Object.keys(record), ...Object.keys(schemaProps ?? {})]);
    const orderedKeys = [...keys].sort((left, right) => left.localeCompare(right));
    body = (
      <div className="space-y-2">
        {orderedKeys.map((key) => {
          const childPointer = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
          const childValue = record[key];
          const childSchema = getChildSchema(normalizedSchema, key, childValue);
          return (
            <FieldNode
              key={childPointer}
              label={key}
              pointer={childPointer}
              schema={childSchema}
              value={childValue}
              mode={mode}
              provenance={provenance}
              focusPointer={focusPointer}
              onPatch={onPatch}
              onJumpToSource={onJumpToSource}
              registerPointer={registerPointer}
            />
          );
        })}
      </div>
    );
  } else if (kind === "array") {
    const list = Array.isArray(value) ? value : [];
    body = (
      <div className="space-y-2">
        {list.map((item, index) => {
          const childPointer = `${pointer}/${index}`;
          const childSchema = getChildSchema(normalizedSchema, String(index), item);
          return (
            <FieldNode
              key={childPointer}
              label={`[${index}]`}
              pointer={childPointer}
              schema={childSchema}
              value={item}
              mode={mode}
              provenance={provenance}
              focusPointer={focusPointer}
              onPatch={onPatch}
              onJumpToSource={onJumpToSource}
              registerPointer={registerPointer}
            />
          );
        })}
      </div>
    );
  } else if (enumValues.length > 0 && scalarEditable) {
    body = (
      <select
        className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
        value={typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""}
        onChange={(event) => {
          const selected = enumValues.find((item) => String(item) === event.target.value);
          if (selected !== undefined) {
            onPatch(pointer, selected);
          }
        }}
      >
        {enumValues.map((item) => (
          <option key={String(item)} value={String(item)}>
            {String(item)}
          </option>
        ))}
      </select>
    );
  } else if (scalarEditable && kind === "boolean") {
    body = (
      <select
        className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
        value={value === true ? "true" : "false"}
        onChange={(event) => onPatch(pointer, event.target.value === "true")}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  } else if (scalarEditable && (kind === "number" || kind === "integer")) {
    body = (
      <Input
        value={typeof value === "number" ? String(value) : ""}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onPatch(pointer, kind === "integer" ? Math.trunc(next) : next);
          }
        }}
        placeholder={kind === "integer" ? "0" : "0.0"}
        className="h-8 text-xs"
      />
    );
  } else if (scalarEditable && kind === "string") {
    body = (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onPatch(pointer, event.target.value)}
        className="h-8 text-xs"
      />
    );
  } else if (isPrimitive(value)) {
    body = <p className="whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">{renderPrimitive(value)}</p>;
  } else {
    body = <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{JSON.stringify(value, null, 2)}</pre>;
  }

  return (
    <article
      ref={(node) => registerPointer(pointer, node)}
      data-settings-pointer={pointer}
      className={cn(
        "space-y-1 rounded-lg border border-slate-200 bg-white px-2 py-2",
        focused ? "ring-2 ring-teal-300" : "",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge variant="secondary" className="max-w-[20rem] truncate text-[10px]">
            {label}
          </Badge>
          {entry ? <FieldProvenance entry={entry} onJumpToSource={onJumpToSource} /> : null}
        </div>
      </header>
      {body}
    </article>
  );
};

export const SettingsSchemaView = ({
  schema,
  value,
  mode,
  provenance,
  focusPointer,
  onValueChange,
  onJumpToSource,
}: SettingsSchemaViewProps) => {
  const pointerElementsRef = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!focusPointer) {
      return;
    }
    const target = pointerElementsRef.current.get(focusPointer);
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusPointer, value]);

  const onPatch = mode === "editable" && onValueChange
    ? (pointer: string, nextValue: unknown) => {
        const nextRoot = patchValueAtPointer(value, pointer, nextValue);
        onValueChange(nextRoot);
      }
    : undefined;

  return (
    <div className="space-y-2">
      <FieldNode
        label="root"
        pointer=""
        schema={schema}
        value={value}
        mode={mode}
        provenance={provenance}
        focusPointer={focusPointer}
        onPatch={onPatch}
        onJumpToSource={onJumpToSource}
        registerPointer={(pointer, element) => {
          if (element) {
            pointerElementsRef.current.set(pointer, element);
            return;
          }
          pointerElementsRef.current.delete(pointer);
        }}
      />
    </div>
  );
};

export const readPointerValue = (value: unknown, pointer: string): unknown => getValueAtPointer(value, pointer);
