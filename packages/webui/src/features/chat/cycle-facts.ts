import type { RuntimeChatCycle as RuntimeChatCycle } from "@agenter/client-sdk";

interface CycleSystemFact {
  key: string;
  source: RuntimeChatCycle["inputs"][number]["source"];
  title: string;
  summary: string;
  detail: string;
}

const pluralize = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const summarizeTerminalFact = (value: string): { title: string; summary: string } => {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return {
      title: "Terminal",
      summary: "raw event",
    };
  }
  const record = parsed as Record<string, unknown>;
  const terminalId = typeof record.terminalId === "string" ? record.terminalId : "terminal";
  const kind = typeof record.kind === "string" ? record.kind : "terminal-event";
  const status = typeof record.status === "string" ? record.status : null;
  const bytes = typeof record.bytes === "number" ? record.bytes : null;
  const seq = typeof record.seq === "number" ? record.seq : null;
  const cols = typeof record.cols === "number" ? record.cols : null;
  const rows = typeof record.rows === "number" ? record.rows : null;

  const parts = [kind];
  if (status) {
    parts.push(status);
  }
  if (bytes !== null) {
    parts.push(`${bytes} bytes`);
  }
  if (seq !== null) {
    parts.push(`#${seq}`);
  }
  if (cols !== null && rows !== null) {
    parts.push(`${cols}x${rows}`);
  }

  return {
    title: `Terminal · ${terminalId}`,
    summary: parts.join(" · "),
  };
};

const summarizeAttentionFact = (value: string): { title: string; summary: string } => {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return {
      title: "Attention",
      summary: "state update",
    };
  }
  const record = parsed as Record<string, unknown>;
  const count = typeof record.count === "number" ? record.count : null;
  return {
    title: "Attention",
    summary: count === null ? "state update" : pluralize(count, "item"),
  };
};

const summarizeTaskFact = (value: string): { title: string; summary: string } => {
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") {
    return {
      title: "Tasks",
      summary: "state update",
    };
  }
  const record = parsed as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : "task-event";
  const active = Array.isArray(record.active) ? record.active.length : null;
  return {
    title: "Tasks",
    summary: active === null ? kind : `${kind} · ${pluralize(active, "active task")}`,
  };
};

const summarizeToolFact = (value: string): { title: string; summary: string } => ({
  title: "Tool",
  summary: value.trim().length > 0 ? "message update" : "tool event",
});

export const splitCycleInputs = (cycle: RuntimeChatCycle): {
  userInputs: RuntimeChatCycle["inputs"];
  systemFacts: CycleSystemFact[];
} => {
  const userInputs = cycle.inputs.filter((input) => input.source === "message" && input.role === "user");
  const systemFacts = cycle.inputs
    .filter((input) => !(input.source === "message" && input.role === "user"))
    .map((input, index) => {
      const text = input.parts
        .filter((part): part is Extract<(typeof input.parts)[number], { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n");

      const summary =
        input.source === "terminal"
          ? summarizeTerminalFact(text)
          : input.source === "attention"
            ? summarizeAttentionFact(text)
            : input.source === "task"
              ? summarizeTaskFact(text)
              : summarizeToolFact(text);

      return {
        key: `${cycle.id}-fact-${index}`,
        source: input.source,
        title: summary.title,
        summary: summary.summary,
        detail: text,
      };
    });

  return { userInputs, systemFacts };
};

export const summarizeSystemFacts = (facts: CycleSystemFact[]): string => {
  const counts = facts.reduce<Record<string, number>>((acc, fact) => {
    acc[fact.source] = (acc[fact.source] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([source, count]) => pluralize(count, source))
    .join(" · ");
};

export type { CycleSystemFact };
