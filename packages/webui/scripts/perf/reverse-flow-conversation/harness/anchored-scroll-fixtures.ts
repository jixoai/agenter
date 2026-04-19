export type AnchoredEvidenceRowTone = "older" | "baseline" | "latest";

export type AnchoredEvidenceRow = {
  id: number;
  title: string;
  body: string;
  collapsedBody: string;
  estimateSize: number;
  collapsed: boolean;
  tone: AnchoredEvidenceRowTone;
};

const buildParagraph = (seed: number, tone: AnchoredEvidenceRowTone): string => {
  const prefix =
    tone === "older"
      ? "Earlier transcript surface used to verify history-start stability."
      : tone === "latest"
        ? "Latest-edge transcript surface used to verify pinned semantics."
        : "Baseline transcript row used to verify semantic scroll ownership.";
  const fragments = [
    "Semantic targets stay expressed as edge, element, and position.",
    "Virtualized hosts keep materialization inside the adapter boundary.",
    "Wheel, touch, keyboard, and momentum need explicit arbitration.",
    "Eventual scroll position stays inspectable instead of hiding in route-local math.",
  ];
  return `${prefix} ${fragments[seed % fragments.length]} ${fragments[(seed + 1) % fragments.length]}`;
};

export const createAnchoredEvidenceRow = (
  id: number,
  tone: AnchoredEvidenceRowTone,
  overrides: Partial<AnchoredEvidenceRow> = {},
): AnchoredEvidenceRow => {
  const body = overrides.body ?? `${buildParagraph(id, tone)} ${buildParagraph(id + 2, tone)}`;
  return {
    id,
    title: tone === "older" ? `History ${id}` : tone === "latest" ? `Latest ${id}` : `Message ${id}`,
    body,
    collapsedBody: overrides.collapsedBody ?? "Collapsed preview keeps the row short while preserving identity.",
    estimateSize: overrides.estimateSize ?? 118 + Math.abs(id % 5) * 26,
    collapsed: overrides.collapsed ?? false,
    tone,
  };
};

export const createAnchoredEvidenceRows = (): AnchoredEvidenceRow[] => {
  return Array.from({ length: 28 }, (_, index) => {
    const id = index + 1;
    return createAnchoredEvidenceRow(id, index >= 22 ? "latest" : "baseline");
  });
};

export const appendAnchoredLatestRow = (
  rows: readonly AnchoredEvidenceRow[],
  nextId: number,
): AnchoredEvidenceRow[] => {
  return [...rows, createAnchoredEvidenceRow(nextId, "latest", { estimateSize: 186 })];
};

export const prependAnchoredOlderRows = (
  rows: readonly AnchoredEvidenceRow[],
  nextOlderId: number,
): { nextItems: AnchoredEvidenceRow[]; nextOlderId: number } => {
  const prepended = [
    createAnchoredEvidenceRow(nextOlderId, "older", { estimateSize: 152 }),
    createAnchoredEvidenceRow(nextOlderId - 1, "older", { estimateSize: 164 }),
  ];
  return {
    nextItems: [...prepended, ...rows],
    nextOlderId: nextOlderId - prepended.length,
  };
};

export const resizeAnchoredLatestRow = (
  rows: readonly AnchoredEvidenceRow[],
): AnchoredEvidenceRow[] => {
  if (rows.length === 0) {
    return [...rows];
  }
  const latest = rows.at(-1)!;
  return [
    ...rows.slice(0, -1),
    {
      ...latest,
      body: `${latest.body} Resize mutation adds another long segment so the rendered height grows noticeably inside the virtual transcript.`,
      estimateSize: latest.estimateSize + 96,
    },
  ];
};

export const collapseAnchoredLatestRow = (
  rows: readonly AnchoredEvidenceRow[],
): AnchoredEvidenceRow[] => {
  if (rows.length === 0) {
    return [...rows];
  }
  const latest = rows.at(-1)!;
  const nextCollapsed = !latest.collapsed;
  return [
    ...rows.slice(0, -1),
    {
      ...latest,
      collapsed: nextCollapsed,
      estimateSize: nextCollapsed ? Math.max(82, latest.estimateSize - 124) : latest.estimateSize + 124,
    },
  ];
};
