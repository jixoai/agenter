import { Ellipsis, Eye } from "lucide-react";
import { memo, useMemo, useState, useSyncExternalStore } from "react";
import { stringify as stringifyYaml } from "yaml";

import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type JsonViewerMode = "raw-text-json" | "fmt-highlight-json" | "highlight-yaml";

interface JsonViewerProps {
  value: unknown;
  rawText?: string;
  className?: string;
  contentClassName?: string;
  menuLabel?: string;
}

const GLOBAL_MODE_STORAGE_KEY = "agenter:webui:json-viewer-mode";
const DEFAULT_JSON_VIEWER_MODE: JsonViewerMode = "highlight-yaml";

const JSON_VIEWER_MODE_OPTIONS: Array<{ mode: JsonViewerMode; label: string; description: string }> = [
  {
    mode: "highlight-yaml",
    label: "YAML preview",
    description: "Compact readable preview",
  },
  {
    mode: "fmt-highlight-json",
    label: "Formatted JSON",
    description: "Pretty JSON with highlighting",
  },
  {
    mode: "raw-text-json",
    label: "Raw JSON",
    description: "Exact plain-text payload",
  },
];

const JSON_PUNCTUATION_CLASS_NAME = "text-slate-400";
const JSON_KEY_CLASS_NAME = "text-slate-500";
const JSON_STRING_CLASS_NAME = "text-sky-700";
const JSON_NUMBER_CLASS_NAME = "text-amber-700";
const JSON_BOOLEAN_CLASS_NAME = "text-emerald-700";
const JSON_NULL_CLASS_NAME = "text-slate-400 italic";

let cachedGlobalMode: JsonViewerMode = DEFAULT_JSON_VIEWER_MODE;
let globalModeInitialized = false;
const globalModeListeners = new Set<() => void>();

const isBrowser = (): boolean => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const normalizeJsonViewerMode = (value: unknown): JsonViewerMode => {
  return value === "raw-text-json" || value === "fmt-highlight-json" || value === "highlight-yaml"
    ? value
    : DEFAULT_JSON_VIEWER_MODE;
};

const readPersistedGlobalMode = (): JsonViewerMode => {
  if (!isBrowser()) {
    return DEFAULT_JSON_VIEWER_MODE;
  }
  try {
    return normalizeJsonViewerMode(window.localStorage.getItem(GLOBAL_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_JSON_VIEWER_MODE;
  }
};

const getGlobalJsonViewerModeSnapshot = (): JsonViewerMode => {
  if (!globalModeInitialized) {
    cachedGlobalMode = readPersistedGlobalMode();
    globalModeInitialized = true;
  }
  return cachedGlobalMode;
};

const subscribeGlobalJsonViewerMode = (listener: () => void): (() => void) => {
  globalModeListeners.add(listener);
  return () => {
    globalModeListeners.delete(listener);
  };
};

const setGlobalJsonViewerMode = (mode: JsonViewerMode): void => {
  const next = normalizeJsonViewerMode(mode);
  const previous = getGlobalJsonViewerModeSnapshot();
  if (previous === next) {
    return;
  }
  cachedGlobalMode = next;
  globalModeInitialized = true;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(GLOBAL_MODE_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the in-memory preference still applies.
    }
  }
  for (const listener of globalModeListeners) {
    listener();
  }
};

const useGlobalJsonViewerMode = (): JsonViewerMode => {
  return useSyncExternalStore(
    subscribeGlobalJsonViewerMode,
    getGlobalJsonViewerModeSnapshot,
    () => DEFAULT_JSON_VIEWER_MODE,
  );
};

export const resolveJsonViewerMode = (input: {
  localMode?: JsonViewerMode | null;
  globalMode?: JsonViewerMode | null;
}): JsonViewerMode => {
  if (input.localMode) {
    return normalizeJsonViewerMode(input.localMode);
  }
  if (input.globalMode) {
    return normalizeJsonViewerMode(input.globalMode);
  }
  return DEFAULT_JSON_VIEWER_MODE;
};

const splitTrailingComma = (value: string): { value: string; comma: string } => {
  return value.endsWith(",") ? { value: value.slice(0, -1), comma: "," } : { value, comma: "" };
};

const renderScalarFragment = (value: string, yaml = false) => {
  if (value.length === 0) {
    return null;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (yaml && /^'.*'$/.test(value))) {
    return <span className={JSON_STRING_CLASS_NAME}>{value}</span>;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return <span className={JSON_NUMBER_CLASS_NAME}>{value}</span>;
  }

  if (value === "true" || value === "false") {
    return <span className={JSON_BOOLEAN_CLASS_NAME}>{value}</span>;
  }

  if (value === "null" || value === "~") {
    return <span className={JSON_NULL_CLASS_NAME}>{value}</span>;
  }

  if (value === "{" || value === "}" || value === "[" || value === "]") {
    return <span className={JSON_PUNCTUATION_CLASS_NAME}>{value}</span>;
  }

  return <span className={yaml ? JSON_STRING_CLASS_NAME : "text-slate-700"}>{value}</span>;
};

const renderJsonLine = (line: string, index: number) => {
  const keyMatch = line.match(/^(\s*)"([^"]+)"(:\s*)(.*)$/);
  if (keyMatch) {
    const [, indent, key, separator, remainder] = keyMatch;
    const { value, comma } = splitTrailingComma(remainder);
    return (
      <div key={`json-${index}`} className="whitespace-pre">
        <span>{indent}</span>
        <span className={JSON_KEY_CLASS_NAME}>&quot;{key}&quot;</span>
        <span className={JSON_PUNCTUATION_CLASS_NAME}>{separator}</span>
        {renderScalarFragment(value)}
        {comma ? <span className={JSON_PUNCTUATION_CLASS_NAME}>{comma}</span> : null}
      </div>
    );
  }

  const arrayValueMatch = line.match(/^(\s*)(.*)$/);
  if (!arrayValueMatch) {
    return <div key={`json-${index}`}>{line}</div>;
  }

  const [, indent, remainder] = arrayValueMatch;
  const { value, comma } = splitTrailingComma(remainder);
  return (
    <div key={`json-${index}`} className="whitespace-pre">
      <span>{indent}</span>
      {renderScalarFragment(value)}
      {comma ? <span className={JSON_PUNCTUATION_CLASS_NAME}>{comma}</span> : null}
    </div>
  );
};

const renderYamlLine = (line: string, index: number) => {
  const keyMatch = line.match(/^(\s*)(-\s+)?([^:#\-][^:]*)(:\s*)(.*)$/);
  if (keyMatch) {
    const [, indent, dash = "", key, separator, remainder] = keyMatch;
    return (
      <div key={`yaml-${index}`} className="whitespace-pre">
        <span>{indent}</span>
        {dash ? <span className={JSON_PUNCTUATION_CLASS_NAME}>{dash}</span> : null}
        <span className={JSON_KEY_CLASS_NAME}>{key}</span>
        <span className={JSON_PUNCTUATION_CLASS_NAME}>{separator}</span>
        {renderScalarFragment(remainder, true)}
      </div>
    );
  }

  const listScalarMatch = line.match(/^(\s*)(-\s+)(.*)$/);
  if (listScalarMatch) {
    const [, indent, dash, remainder] = listScalarMatch;
    return (
      <div key={`yaml-${index}`} className="whitespace-pre">
        <span>{indent}</span>
        <span className={JSON_PUNCTUATION_CLASS_NAME}>{dash}</span>
        {renderScalarFragment(remainder, true)}
      </div>
    );
  }

  return (
    <div key={`yaml-${index}`} className="whitespace-pre text-slate-700">
      {line}
    </div>
  );
};

const renderHighlightedText = (mode: JsonViewerMode, text: string) => {
  const lines = text.split("\n");
  if (mode === "highlight-yaml") {
    return lines.map(renderYamlLine);
  }
  return lines.map(renderJsonLine);
};

const modeLabel = (mode: JsonViewerMode): string => {
  return JSON_VIEWER_MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? mode;
};

const serializeJson = (value: unknown): string => {
  return JSON.stringify(value, null, 2) ?? "null";
};

const serializeYaml = (value: unknown): string => {
  return stringifyYaml(value, {
    indent: 2,
    lineWidth: 0,
  }).trimEnd();
};

const JsonViewerComponent = ({
  value,
  rawText,
  className,
  contentClassName,
  menuLabel = "Structured value options",
}: JsonViewerProps) => {
  const globalMode = useGlobalJsonViewerMode();
  const [localMode, setLocalMode] = useState<JsonViewerMode | null>(null);
  const activeMode = resolveJsonViewerMode({ localMode, globalMode });
  const jsonText = useMemo(() => serializeJson(value), [value]);
  const yamlText = useMemo(() => serializeYaml(value), [value]);
  const rawJsonText = rawText ?? jsonText;
  const renderedText = activeMode === "highlight-yaml" ? yamlText : activeMode === "fmt-highlight-json" ? jsonText : rawJsonText;

  return (
    <div className={cn("group relative rounded-xl border border-slate-200 bg-slate-50/85", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={menuLabel}
          className="absolute top-2 right-2 z-10 h-7 w-7 rounded-md bg-white/92 opacity-0 shadow-xs ring-1 ring-slate-200 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
        >
          <Ellipsis className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-64">
          <DropdownMenuLabel>Current viewer</DropdownMenuLabel>
          <DropdownMenuSubTrigger>{modeLabel(activeMode)}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {JSON_VIEWER_MODE_OPTIONS.map((option) => (
              <DropdownMenuItem key={`local-${option.mode}`} onClick={() => setLocalMode(option.mode)}>
                <DropdownMenuItemIndicator className={cn(activeMode === option.mode ? "opacity-100" : "opacity-0")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-900">{option.label}</div>
                  <div className="text-[11px] text-slate-500">{option.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>All JSON viewers</DropdownMenuLabel>
          <DropdownMenuSubTrigger>{modeLabel(globalMode)}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {JSON_VIEWER_MODE_OPTIONS.map((option) => (
              <DropdownMenuItem key={`global-${option.mode}`} onClick={() => setGlobalJsonViewerMode(option.mode)}>
                <DropdownMenuItemIndicator className={cn(globalMode === option.mode ? "opacity-100" : "opacity-0")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-900">{option.label}</div>
                  <div className="text-[11px] text-slate-500">{option.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className={cn("min-w-0 overflow-x-auto rounded-xl p-3 pr-10 typo-code text-[11px] leading-5", contentClassName)}>
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] text-slate-500 ring-1 ring-slate-200/80">
          <Eye className="h-3 w-3" />
          <span>{modeLabel(activeMode)}</span>
        </div>
        {activeMode === "raw-text-json" ? (
          <pre className="whitespace-pre-wrap break-words text-slate-700">{renderedText}</pre>
        ) : (
          <div className="whitespace-pre-wrap break-words text-slate-700">{renderHighlightedText(activeMode, renderedText)}</div>
        )}
      </div>
    </div>
  );
};

const jsonViewerPropsEqual = (left: JsonViewerProps, right: JsonViewerProps): boolean => {
  return (
    left.value === right.value &&
    left.rawText === right.rawText &&
    left.className === right.className &&
    left.contentClassName === right.contentClassName &&
    left.menuLabel === right.menuLabel
  );
};

export const JSONViewer = memo(JsonViewerComponent, jsonViewerPropsEqual);
JSONViewer.displayName = "JSONViewer";
export { DEFAULT_JSON_VIEWER_MODE, JSON_VIEWER_MODE_OPTIONS, normalizeJsonViewerMode, setGlobalJsonViewerMode };
