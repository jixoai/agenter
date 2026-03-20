import type { RuntimeChatCycle } from "@agenter/client-sdk";

import { splitCycleInputs, summarizeSystemFacts } from "./cycle-facts";

const summarizeText = (value: string, fallback: string): string => {
  const normalized = value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return normalized ?? fallback;
};

export const formatCycleTitle = (cycle: RuntimeChatCycle, fallbackOrdinal?: number): string => {
  if (cycle.cycleId === null) {
    return fallbackOrdinal ? `Pending cycle ${fallbackOrdinal}` : "Pending cycle";
  }
  return `Cycle ${cycle.cycleId}`;
};

export const formatCycleBadge = (cycle: RuntimeChatCycle, fallbackOrdinal?: number): string => {
  if (cycle.cycleId === null) {
    return fallbackOrdinal ? `P${fallbackOrdinal}` : "Pending";
  }
  return `#${cycle.cycleId}`;
};

export const getCycleStatusMeta = (
  cycle: RuntimeChatCycle,
): {
  label: string;
  toneClassName: string;
  railClassName: string;
} => {
  switch (cycle.status) {
    case "error":
      return {
        label: "Error",
        toneClassName: "bg-rose-100 text-rose-700",
        railClassName: "border-rose-300 bg-rose-50 text-rose-700",
      };
    case "streaming":
      return {
        label: "Streaming",
        toneClassName: "bg-teal-100 text-teal-700",
        railClassName: "border-teal-300 bg-teal-50 text-teal-700",
      };
    case "collecting":
      return {
        label: "Collecting",
        toneClassName: "bg-amber-100 text-amber-700",
        railClassName: "border-amber-300 bg-amber-50 text-amber-700",
      };
    case "applying":
      return {
        label: "Applying",
        toneClassName: "bg-sky-100 text-sky-700",
        railClassName: "border-sky-300 bg-sky-50 text-sky-700",
      };
    case "pending":
      return {
        label: "Pending",
        toneClassName: "bg-slate-100 text-slate-600",
        railClassName: "border-slate-300 bg-slate-100 text-slate-600",
      };
    default:
      return {
        label: "Done",
        toneClassName: "bg-emerald-100 text-emerald-700",
        railClassName: "border-emerald-300 bg-emerald-50 text-emerald-700",
      };
  }
};

export const summarizeCycle = (cycle: RuntimeChatCycle): string => {
  const { userInputs, systemFacts } = splitCycleInputs(cycle);
  const userText = userInputs
    .flatMap((input) => input.parts)
    .filter(
      (
        part,
      ): part is Extract<RuntimeChatCycle["inputs"][number]["parts"][number], { type: "text" }> => part.type === "text",
    )
    .map((part) => part.text)
    .join("\n");
  if (userText.trim().length > 0) {
    return summarizeText(userText, "User input");
  }

  const attachmentCount = userInputs.flatMap((input) => input.parts).filter((part) => part.type !== "text").length;
  if (attachmentCount > 0) {
    return `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`;
  }

  const assistantText = [...cycle.outputs, ...cycle.liveMessages]
    .filter((message) => message.role === "assistant" && message.channel === "to_user")
    .map((message) => message.content)
    .join("\n");
  if (assistantText.trim().length > 0) {
    return summarizeText(assistantText, "Assistant reply");
  }

  if (cycle.streaming?.content.trim().length) {
    return summarizeText(cycle.streaming.content, "Streaming reply");
  }

  if (systemFacts.length > 0) {
    return summarizeSystemFacts(systemFacts);
  }

  return cycle.kind === "compact" ? "Context compaction" : "No conversation content yet";
};
