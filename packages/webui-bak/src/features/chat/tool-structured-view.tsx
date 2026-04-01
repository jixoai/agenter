import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

interface ToolStructuredViewProps {
  value: unknown;
  depth?: number;
}

type Scalar = string | number | boolean | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is Scalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null;

const scalarTone = (value: Scalar): string => {
  if (typeof value === "number") {
    return "text-amber-700";
  }
  if (typeof value === "boolean") {
    return value ? "text-emerald-700" : "text-rose-700";
  }
  if (value === null) {
    return "text-slate-400 italic";
  }
  return "text-sky-700";
};

const StringValue = ({ value }: { value: string }) => {
  if (value.includes("\n")) {
    return (
      <pre className="typo-code overflow-x-auto rounded-md bg-sky-50/70 px-2 py-1 text-[11px] leading-5 whitespace-pre text-sky-700 ring-1 ring-sky-100">
        {value}
      </pre>
    );
  }

  return (
    <span className="typo-code inline-flex max-w-full overflow-x-auto text-[11px] leading-5 whitespace-nowrap text-sky-700">
      <span className="text-sky-400">"</span>
      {value}
      <span className="text-sky-400">"</span>
    </span>
  );
};

const ScalarValue = ({ value }: { value: Scalar }) => {
  if (typeof value === "string") {
    return <StringValue value={value} />;
  }

  return <span className={cn("typo-code text-[11px] leading-5", scalarTone(value))}>{String(value)}</span>;
};

const NestedBlock = ({ children }: { children: ReactNode }) => (
  <div className="ml-2 border-l border-slate-200/90 pl-2">{children}</div>
);

const summaryLabel = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    return `[${value.length}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).length}}`;
  }
  return null;
};

const StructuredArray = ({ value, depth }: { value: unknown[]; depth: number }) => {
  return (
    <div className="space-y-0.5" data-tool-structured="array">
      {value.map((item, index) => {
        const nested = !isScalar(item);
        return (
          <div key={`${depth}-item-${index}`} className="space-y-0.5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2">
              <span className="typo-code pt-px text-[10px] leading-5 text-slate-400">[{index}]</span>
              <div className="min-w-0">
                {nested ? (
                  <NestedBlock>
                    <ToolStructuredView value={item} depth={depth + 1} />
                  </NestedBlock>
                ) : (
                  <ScalarValue value={item} />
                )}
              </div>
            </div>
          </div>
        );
      })}
      {value.length === 0 ? <span className="typo-code text-[11px] text-slate-400">[]</span> : null}
    </div>
  );
};

export const ToolStructuredView = ({ value, depth = 0 }: ToolStructuredViewProps) => {
  if (Array.isArray(value)) {
    return <StructuredArray value={value} depth={depth} />;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="typo-code text-[11px] text-slate-400">{"{}"}</span>;
    }

    return (
      <div className="space-y-0.5" data-tool-structured="object">
        {entries.map(([key, next]) => {
          const nested = !isScalar(next);
          const summary = summaryLabel(next);
          return (
            <div key={`${depth}-${key}`} className="space-y-0.5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2">
                <span className="typo-code flex items-center gap-1 pt-px text-[11px] leading-5 font-medium text-slate-500">
                  <span>{key}</span>
                  {summary ? <span className="text-[10px] font-normal text-slate-400">{summary}</span> : null}
                </span>
                <div className="min-w-0">
                  {nested ? (
                    <NestedBlock>
                      <ToolStructuredView value={next} depth={depth + 1} />
                    </NestedBlock>
                  ) : (
                    <ScalarValue value={next} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return isScalar(value) ? <ScalarValue value={value} /> : null;
};
