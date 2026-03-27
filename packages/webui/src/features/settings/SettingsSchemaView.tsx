import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Tooltip } from "../../components/ui/tooltip";
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

const asSchemaRecord = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null);

const asSchemaList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map((item) => asSchemaRecord(item)).filter((item): item is Record<string, unknown> => item !== null) : [];

const toSchemaKind = (schema: Record<string, unknown> | null, value: unknown): SchemaKind => {
  const rawType = schema?.type;
  if (typeof rawType === "string") {
    if (
      rawType === "object" ||
      rawType === "array" ||
      rawType === "string" ||
      rawType === "number" ||
      rawType === "integer" ||
      rawType === "boolean" ||
      rawType === "null"
    ) {
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
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
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

const readDescription = (schema: Record<string, unknown> | null): string | null => {
  const value = schema?.description;
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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
    return asSchemaRecord(normalized.additionalProperties);
  }
  if (kind === "array") {
    return asSchemaRecord(normalized.items);
  }
  return null;
};

const shortPath = (path: string): string => (path.length <= 42 ? path : `...${path.slice(-39)}`);

const renderPrimitive = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));

const readEnumValues = (schema: Record<string, unknown> | null): Array<string | number | boolean> => {
  if (!schema || !Array.isArray(schema.enum)) {
    return [];
  }
  return schema.enum.filter(
    (item): item is string | number | boolean =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  );
};

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => isEmptyValue(item));
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 || keys.every((key) => isEmptyValue(value[key]));
  }
  return false;
};

const summarizeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "empty";
  }
  if (typeof value === "string") {
    return value.trim().length === 0 ? "empty" : value;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `array(${value.length})`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "{}" : `object(${keys.length})`;
  }
  return String(value);
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
  const activate = () => {
    if (!entry?.jumpTarget || !onJumpToSource) {
      return;
    }
    onJumpToSource(entry.jumpTarget);
  };
  if (entry?.jumpTarget && onJumpToSource) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={`Jump to source ${origin.path} ${origin.pointer}`}
        data-settings-source-layer={origin.layerId}
        data-settings-source-pointer={origin.pointer}
        data-settings-source-path={origin.path}
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          activate();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          activate();
        }}
      >
        {shortPath(label)}
      </span>
    );
  }
  return <span className="text-[10px] text-slate-500">{shortPath(label)}</span>;
};

const FieldHelp = ({ label, text }: { label: string; text: string | null }) => (
  <Tooltip content={text ?? `No description for ${label}.`}>
    <span
      role="button"
      tabIndex={0}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] leading-none text-slate-500"
      aria-label={`Explain ${label}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      ?
    </span>
  </Tooltip>
);

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
  isRoot?: boolean;
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
  isRoot = false,
}: FieldNodeProps) => {
  const entry = provenance?.[pointer];
  const normalizedSchema = pickUnionSchema(schema, value);
  const enumValues = readEnumValues(normalizedSchema);
  const kind = toSchemaKind(normalizedSchema, value);
  const description = readDescription(normalizedSchema);
  const focused = focusPointer === pointer;
  const scalarEditable =
    mode === "editable" && onPatch && (kind === "string" || kind === "number" || kind === "integer" || kind === "boolean");
  const placeholder = scalarEditable && (kind === "string" || kind === "number" || kind === "integer") ? description : null;
  const showHelpIcon = placeholder === null;
  const [expanded, setExpanded] = useState(() => isRoot || focused || !isEmptyValue(value));

  useEffect(() => {
    if (focused) {
      setExpanded(true);
    }
  }, [focused]);

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
        placeholder={placeholder ?? undefined}
        className="h-8 text-xs"
      />
    );
  } else if (scalarEditable && kind === "string") {
    body = (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onPatch(pointer, event.target.value)}
        placeholder={placeholder ?? undefined}
        className="h-8 text-xs"
      />
    );
  } else if (isPrimitive(value)) {
    body = (
      <p className="whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
        {renderPrimitive(value)}
      </p>
    );
  } else {
    body = (
      <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  const header = (
    <div className="flex min-w-0 items-center gap-1.5">
      <Badge variant="secondary" className="max-w-[20rem] truncate text-[10px]">
        {label}
      </Badge>
      {showHelpIcon ? <FieldHelp label={label} text={description} /> : null}
      {entry ? <FieldProvenance entry={entry} onJumpToSource={onJumpToSource} /> : null}
      {!isRoot ? (
        <span className="max-w-[14rem] truncate text-[10px] text-slate-400">{summarizeValue(value)}</span>
      ) : null}
    </div>
  );

  if (isRoot) {
    return (
      <article
        ref={(node) => registerPointer(pointer, node)}
        data-settings-pointer={pointer}
        className={cn("space-y-2 rounded-lg border border-slate-200 bg-white px-2 py-2", focused ? "ring-2 ring-teal-300" : "")}
      >
        <header className="flex flex-wrap items-center justify-between gap-2">{header}</header>
        {body}
      </article>
    );
  }

  return (
    <div ref={(node) => registerPointer(pointer, node)} data-settings-pointer={pointer}>
      <Accordion
        type="single"
        collapsible
        value={expanded ? [pointer] : []}
        onValueChange={(next) => {
          setExpanded(next.includes(pointer));
        }}
      >
        <AccordionItem
          value={pointer}
          className={cn("rounded-lg border border-slate-200 bg-white px-2", focused ? "ring-2 ring-teal-300" : "")}
        >
          <AccordionTrigger data-settings-pointer-trigger={pointer} className="hover:no-underline">
            {header}
          </AccordionTrigger>
          <AccordionContent className="pt-1">{body}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
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

  const onPatch = useMemo(
    () =>
      mode === "editable" && onValueChange
        ? (pointer: string, nextValue: unknown) => {
            const nextRoot = patchValueAtPointer(value, pointer, nextValue);
            onValueChange(nextRoot);
          }
        : undefined,
    [mode, onValueChange, value],
  );

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
        isRoot
      />
    </div>
  );
};

export const readPointerValue = (value: unknown, pointer: string): unknown => getValueAtPointer(value, pointer);
