export type DevtoolsPanelId = "attention" | "cycles" | "systems" | "observability";
export type AttentionDetailView = "context" | "items" | "search";

export interface SessionDevtoolsSearch {
  panel: DevtoolsPanelId;
  cycleId?: number;
  contextId?: string;
  commitId?: string;
  attentionView: AttentionDetailView;
  attentionQuery?: string;
}

const readSearchString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readPositiveInt = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const normalizePanel = (value: unknown, cycleId?: number): DevtoolsPanelId => {
  if (value === "cycles" || value === "systems" || value === "observability" || value === "attention") {
    return value;
  }
  return cycleId ? "cycles" : "attention";
};

const normalizeAttentionView = (value: unknown, attentionQuery?: string): AttentionDetailView => {
  if (value === "search") {
    return "search";
  }
  if (value === "items") {
    return attentionQuery ? "search" : "items";
  }
  return "context";
};

export const validateSessionDevtoolsSearch = (search: Record<string, unknown>): SessionDevtoolsSearch => {
  const cycleId = readPositiveInt(search.cycleId);
  const attentionQuery = readSearchString(search.attentionQuery);
  return {
    panel: normalizePanel(search.panel, cycleId),
    cycleId,
    contextId: readSearchString(search.contextId),
    commitId: readSearchString(search.commitId),
    attentionView: normalizeAttentionView(search.attentionView, attentionQuery),
    attentionQuery,
  };
};

export const buildSessionDevtoolsSearch = (
  patch: Partial<SessionDevtoolsSearch>,
  current?: SessionDevtoolsSearch,
): SessionDevtoolsSearch => {
  const next = {
    ...(current ?? {
      panel: "attention" as const,
      attentionView: "context" as const,
    }),
    ...patch,
  };

  return validateSessionDevtoolsSearch(next);
};
