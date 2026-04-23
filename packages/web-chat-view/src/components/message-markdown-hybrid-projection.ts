import { normalizeMarkdownCodeLanguage } from "@agenter/web-components";
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";

export interface MarkdownProjectionRange {
  from: number;
  to: number;
}

export interface MarkdownTableRowProjection {
  kind: "header" | "body";
  cells: readonly string[];
}

export interface MarkdownTableProjection {
  kind: "table";
  from: number;
  to: number;
  rows: readonly MarkdownTableRowProjection[];
}

export interface MarkdownFencedCodeProjection {
  kind: "fenced-code";
  from: number;
  to: number;
  rawInfo: string;
  language: string;
  code: string;
}

export type MarkdownStructuralProjection = MarkdownTableProjection | MarkdownFencedCodeProjection;

export interface MarkdownStructuralProjectionState {
  projected: readonly MarkdownStructuralProjection[];
  revealedRanges: readonly MarkdownProjectionRange[];
}

interface CollectMarkdownStructuralProjectionInput {
  visibleRanges?: readonly MarkdownProjectionRange[];
  selectionRanges?: readonly MarkdownProjectionRange[];
}

const defaultVisibleRanges = (state: EditorState): readonly MarkdownProjectionRange[] => [
  { from: 0, to: state.doc.length },
];

const normalizeSelectionRanges = (
  state: EditorState,
  selectionRanges?: readonly MarkdownProjectionRange[],
): readonly MarkdownProjectionRange[] =>
  (selectionRanges ??
    state.selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
    }))).filter((range) => range.from !== range.to);

const rangeIntersects = (left: MarkdownProjectionRange, right: MarkdownProjectionRange): boolean => {
  if (left.from === left.to) {
    return left.from >= right.from && left.from < right.to;
  }
  if (right.from === right.to) {
    return right.from >= left.from && right.from < left.to;
  }
  return left.from < right.to && left.to > right.from;
};

const overlapsSelection = (
  selectionRanges: readonly MarkdownProjectionRange[],
  candidate: MarkdownProjectionRange,
): boolean => selectionRanges.some((range) => rangeIntersects(range, candidate));

const pushUniqueRange = (
  ranges: MarkdownProjectionRange[],
  seen: Set<string>,
  candidate: MarkdownProjectionRange,
): void => {
  const key = `${candidate.from}:${candidate.to}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  ranges.push(candidate);
};

const readNodeText = (state: EditorState, node: SyntaxNode): string => state.doc.sliceString(node.from, node.to);

const readTableCellText = (state: EditorState, node: SyntaxNode): string =>
  readNodeText(state, node)
    .replace(/\r?\n/gu, " ")
    .replace(/\\\|/gu, "|")
    .trim();

const collectTableCells = (state: EditorState, rowNode: SyntaxNode): readonly string[] => {
  const cells: string[] = [];
  for (let child = rowNode.firstChild; child; child = child.nextSibling) {
    if (child.name !== "TableCell") {
      continue;
    }
    cells.push(readTableCellText(state, child));
  }
  return cells;
};

const buildTableProjection = (state: EditorState, node: SyntaxNodeRef): MarkdownTableProjection | null => {
  const rows: MarkdownTableRowProjection[] = [];

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name !== "TableHeader" && child.name !== "TableRow") {
      continue;
    }
    const cells = collectTableCells(state, child);
    if (cells.length === 0) {
      continue;
    }
    rows.push({
      kind: child.name === "TableHeader" ? "header" : "body",
      cells,
    });
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    kind: "table",
    from: node.from,
    to: node.to,
    rows,
  };
};

const buildFencedCodeProjection = (state: EditorState, node: SyntaxNodeRef): MarkdownFencedCodeProjection => {
  const infoNode = node.node.getChild("CodeInfo");
  const textNode = node.node.getChild("CodeText");
  const rawInfo = infoNode ? state.doc.sliceString(infoNode.from, infoNode.to).trim() : "";

  return {
    kind: "fenced-code",
    from: node.from,
    to: node.to,
    rawInfo,
    language: normalizeMarkdownCodeLanguage(rawInfo),
    code: textNode ? state.doc.sliceString(textNode.from, textNode.to) : "",
  };
};

export const collectMarkdownStructuralProjectionState = (
  state: EditorState,
  input: CollectMarkdownStructuralProjectionInput = {},
): MarkdownStructuralProjectionState => {
  const visibleRanges = input.visibleRanges ?? defaultVisibleRanges(state);
  const selectionRanges = normalizeSelectionRanges(state, input.selectionRanges);
  const projected: MarkdownStructuralProjection[] = [];
  const revealedRanges: MarkdownProjectionRange[] = [];
  const projectedKeys = new Set<string>();
  const revealedKeys = new Set<string>();

  for (const range of visibleRanges) {
    syntaxTree(state).iterate({
      from: range.from,
      to: range.to,
      enter: (node) => {
        if (node.name !== "Table" && node.name !== "FencedCode") {
          return undefined;
        }

        const candidateRange = { from: node.from, to: node.to };
        if (overlapsSelection(selectionRanges, candidateRange)) {
          pushUniqueRange(revealedRanges, revealedKeys, candidateRange);
          return false;
        }

        const key = `${node.name}:${node.from}:${node.to}`;
        if (projectedKeys.has(key)) {
          return false;
        }

        projectedKeys.add(key);
        if (node.name === "Table") {
          const tableProjection = buildTableProjection(state, node);
          if (tableProjection) {
            projected.push(tableProjection);
          }
          return false;
        }

        projected.push(buildFencedCodeProjection(state, node));
        return false;
      },
    });
  }

  projected.sort((left, right) => left.from - right.from || left.to - right.to);
  revealedRanges.sort((left, right) => left.from - right.from || left.to - right.to);

  return {
    projected,
    revealedRanges,
  };
};
