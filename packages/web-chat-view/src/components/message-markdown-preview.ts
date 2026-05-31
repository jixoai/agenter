import { syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { Facet, StateField, type ChangeDesc, type EditorState, type Extension } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";

import type { WebChatResourceReference } from "../types";
import {
  collectMarkdownStructuralProjectionState,
  type MarkdownProjectionRange,
} from "./message-markdown-hybrid-projection";
import { markdownHighlightStyle, markdownPreviewTheme } from "./message-markdown-preview-theme";
import {
  bulletDecoration,
  orderedDecoration,
  resolveDefinitionResourceReference,
  resourceBarDecoration,
  revealStructuralSourceEffect,
  structuralOverlayDecoration,
  taskMarkerDecoration,
} from "./message-markdown-preview-widgets";
import {
  collectInlineResourceTokenDecorations,
  resolveInlineResourceTokenNode,
} from "./message-markdown-resource-token-projection";

const HIDDEN_TOKENS = ["HeaderMark", "EmphasisMark", "LinkMark", "URL", "HardBreak", "QuoteMark"];

const hiddenDecoration = Decoration.mark({ class: "cm-md-hidden" });
const blockquoteLine = Decoration.line({ class: "cm-md-blockquote-line" });
const linkDecoration = Decoration.mark({ class: "cm-md-link" });
const imageDecoration = Decoration.mark({ class: "cm-md-image" });
const fadedDecoration = Decoration.mark({ class: "cm-md-faded" });
const taskFadedDecoration = Decoration.mark({ class: "cm-md-task-faded" });
const inlineCodeDecoration = Decoration.mark({ class: "cm-md-inlinecode" });
const structuralSourceHiddenDecoration = Decoration.mark({ class: "cm-md-structural-source-hidden" });
const blockHiddenDecoration = Decoration.replace({ block: true });

type MarkdownPreviewResourceContext = {
  resources: readonly WebChatResourceReference[];
  tone: "assistant" | "participant" | "viewer";
  onOpenResource?: ((resource: WebChatResourceReference) => void) | undefined;
};

type ResourceDefinitionProjection = {
  hiddenLineRanges: readonly MarkdownProjectionRange[];
  aggregatedResources: readonly WebChatResourceReference[];
};

const defaultResourceContext: MarkdownPreviewResourceContext = {
  resources: [],
  tone: "participant",
  onOpenResource: undefined,
};

const markdownPreviewResourceFacet = Facet.define<MarkdownPreviewResourceContext, MarkdownPreviewResourceContext>({
  combine: (values) => values.at(-1) ?? defaultResourceContext,
});

const normalizeDecorationRange = (docLength: number, from: number, to: number): { from: number; to: number } | null => {
  const start = Math.max(0, Math.min(from, docLength));
  const end = Math.max(start, Math.min(to, docLength));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return { from: start, to: end };
};

const rangeContains = (ranges: readonly MarkdownProjectionRange[], from: number, to: number): boolean =>
  ranges.some((range) => from >= range.from && to <= range.to);

const rangeIntersects = (left: MarkdownProjectionRange, right: MarkdownProjectionRange): boolean => {
  if (left.from === left.to) {
    return left.from >= right.from && left.from < right.to;
  }
  if (right.from === right.to) {
    return right.from >= left.from && right.from < left.to;
  }
  return left.from < right.to && left.to > right.from;
};

const mapProjectionRange = (range: MarkdownProjectionRange, changes: ChangeDesc): MarkdownProjectionRange | null => {
  const from = changes.mapPos(range.from, 1);
  const to = changes.mapPos(range.to, -1);
  if (to <= from) {
    return null;
  }
  return { from, to };
};

const buildInlineDecorations = (
  state: EditorState,
  projectedRanges: readonly MarkdownProjectionRange[],
  revealedRanges: readonly MarkdownProjectionRange[],
  resourceContext: MarkdownPreviewResourceContext,
  hiddenDefinitionRanges: readonly MarkdownProjectionRange[],
): Array<{ from: number; to: number; decoration: Decoration }> => {
  const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const selectedLines = state.selection.ranges
    .filter((range) => range.from !== range.to)
    .map((range) => {
      const lineFrom = state.doc.lineAt(range.from);
      const lineTo = state.doc.lineAt(range.to);
      return { from: Math.min(lineFrom.from, lineTo.from), to: Math.max(lineFrom.to, lineTo.to) };
    });
  decorations.push(
    ...collectInlineResourceTokenDecorations(state, {
      resources: resourceContext.resources,
      tone: resourceContext.tone,
      onOpenResource: resourceContext.onOpenResource,
      excludedRanges: hiddenDefinitionRanges,
      shouldRevealTokenText: (range) =>
        selectedLines.some((selectedLine) => range.from < selectedLine.to && range.to > selectedLine.from),
    }),
  );
  const listStack: number[] = [];
  const blockquoteLineStarts = new Set<number>();

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node: SyntaxNodeRef) => {
      if (rangeContains(hiddenDefinitionRanges, node.from, node.to)) {
        return false;
      }

      if ((node.name === "Table" || node.name === "FencedCode") && rangeContains(projectedRanges, node.from, node.to)) {
        return false;
      }

      const isSelectedLine = selectedLines.some((range) => node.from < range.to && node.to > range.from);
      const isRevealedStructuralRange = rangeContains(revealedRanges, node.from, node.to);
      const parentName = node.node.parent?.name ?? "";
      const grandName = node.node.parent?.parent?.name ?? "";
      const isOrderedList = parentName.includes("OrderedList") || grandName.includes("OrderedList");
      const text = state.doc.sliceString(node.from, node.to);

      if (node.name === "OrderedList") {
        listStack.push(1);
        return undefined;
      }

      if (node.name === "Blockquote") {
        const firstLine = state.doc.lineAt(node.from).number;
        const lastLine = state.doc.lineAt(node.to).number;
        for (let lineNo = firstLine; lineNo <= lastLine; lineNo += 1) {
          const line = state.doc.line(lineNo);
          if (blockquoteLineStarts.has(line.from)) {
            continue;
          }
          blockquoteLineStarts.add(line.from);
          decorations.push({ from: line.from, to: line.from, decoration: blockquoteLine });
        }
        return undefined;
      }

      if (node.name === "Link") {
        const resource = resolveInlineResourceTokenNode(state, node, resourceContext.resources);
        if (resource && !isSelectedLine) {
          return false;
        }
        const label = node.node.getChild("LinkLabel");
        if (label) {
          decorations.push({ from: label.from, to: label.to, decoration: linkDecoration });
        }
        return undefined;
      }

      if (node.name === "Image") {
        decorations.push({ from: node.from, to: node.to, decoration: imageDecoration });
        return undefined;
      }

      if (node.name === "InlineCode" && !isSelectedLine) {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: inlineCodeDecoration,
        });
        return undefined;
      }

      if (node.name === "ListMark") {
        if (isOrderedList) {
          const current = listStack[listStack.length - 1] ?? 1;
          decorations.push({
            from: node.from,
            to: node.to,
            decoration: isSelectedLine ? fadedDecoration : orderedDecoration(current, false),
          });
          if (listStack.length > 0) {
            listStack[listStack.length - 1] = current + 1;
          }
          return undefined;
        }

        decorations.push({
          from: node.from,
          to: node.to,
          decoration: isSelectedLine ? fadedDecoration : bulletDecoration(false),
        });
        return undefined;
      }

      if (node.name === "TaskMarker") {
        const checked = /\[[xX]\]/u.test(text);
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: isSelectedLine ? taskFadedDecoration : taskMarkerDecoration(checked),
        });
        return undefined;
      }

      if (node.name === "CodeMark") {
        if (isRevealedStructuralRange) {
          return undefined;
        }
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: isSelectedLine ? fadedDecoration : hiddenDecoration,
        });
        return undefined;
      }

      if (node.name === "HeaderMark") {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: isSelectedLine ? fadedDecoration : hiddenDecoration,
        });
        return undefined;
      }

      if (HIDDEN_TOKENS.includes(node.name)) {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: isSelectedLine ? fadedDecoration : hiddenDecoration,
        });
      }

      return undefined;
    },
    leave: (node) => {
      if (node.name === "OrderedList") {
        listStack.pop();
      }
    },
  });

  return decorations;
};

const collectResourceDefinitionProjection = (
  state: EditorState,
  resourceContext: MarkdownPreviewResourceContext,
): ResourceDefinitionProjection => {
  const resourceIdsWithHiddenDefinitions = new Set<string>();
  const hiddenLineRanges: MarkdownProjectionRange[] = [];

  for (let lineNo = 1; lineNo <= state.doc.lines; lineNo += 1) {
    const line = state.doc.line(lineNo);
    const definitionMatch = /^\[\^(.+?)\]:/u.exec(line.text.trim());
    if (!definitionMatch) {
      continue;
    }
    const resource = resolveDefinitionResourceReference(resourceContext.resources, definitionMatch[1] ?? "");
    if (!resource) {
      continue;
    }
    resourceIdsWithHiddenDefinitions.add(resource.id);
    hiddenLineRanges.push({
      from: line.from,
      to: Math.min(state.doc.length, line.to + (line.to < state.doc.length ? 1 : 0)),
    });
  }

  const aggregatedResources = resourceContext.resources.filter((resource, index, resources) => {
    if (resources.findIndex((candidate) => candidate.id === resource.id) !== index) {
      return false;
    }
    return resourceIdsWithHiddenDefinitions.has(resource.id) || resource.tokenText.trim().length > 0;
  });

  return {
    hiddenLineRanges,
    aggregatedResources,
  };
};

const buildResourceDefinitionDecorations = (
  state: EditorState,
  resourceContext: MarkdownPreviewResourceContext,
  projection: ResourceDefinitionProjection,
): Array<{ from: number; to: number; decoration: Decoration }> => {
  const decorations: Array<{ from: number; to: number; decoration: Decoration }> = projection.hiddenLineRanges.map(
    (range) => ({
      from: range.from,
      to: range.to,
      decoration: blockHiddenDecoration,
    }),
  );

  if (projection.aggregatedResources.length === 0) {
    return decorations;
  }

  decorations.push({
    from: state.doc.length,
    to: state.doc.length,
    decoration: resourceBarDecoration(
      projection.aggregatedResources,
      resourceContext.tone,
      resourceContext.onOpenResource,
    ),
  });

  return decorations;
};

const buildDecorationSet = (state: EditorState): DecorationSet => {
  const revealRanges = state.field(structuralRevealStateField);
  const resourceContext = state.facet(markdownPreviewResourceFacet);
  const resourceDefinitionProjection = collectResourceDefinitionProjection(state, resourceContext);
  const structuralState = collectMarkdownStructuralProjectionState(state, {
    selectionRanges: state.selection.ranges
      .filter((range) => range.from !== range.to)
      .map((range) => ({
        from: range.from,
        to: range.to,
      })),
    revealRanges,
  });
  const widgets: Array<{ from: number; to: number; decoration: Decoration }> = [
    ...structuralState.projected.map((projection) => ({
      from: projection.from,
      to: projection.from,
      decoration: structuralOverlayDecoration(projection),
    })),
    ...structuralState.projected.map((projection) => ({
      from: projection.from,
      to: projection.to,
      decoration: structuralSourceHiddenDecoration,
    })),
    ...buildInlineDecorations(
      state,
      structuralState.projected.map(({ from, to }) => ({ from, to })),
      structuralState.revealedRanges,
      resourceContext,
      resourceDefinitionProjection.hiddenLineRanges,
    ),
    ...buildResourceDefinitionDecorations(state, resourceContext, resourceDefinitionProjection),
  ];

  widgets.sort((left, right) => left.from - right.from || left.to - right.to);
  const docLength = state.doc.length;

  return Decoration.set(
    widgets.flatMap((widget) => {
      const range = normalizeDecorationRange(docLength, widget.from, widget.to);
      return range ? [widget.decoration.range(range.from, range.to)] : [];
    }),
  );
};

const structuralRevealStateField = StateField.define<readonly MarkdownProjectionRange[]>({
  create: () => [],
  update: (value, transaction) => {
    let next = transaction.docChanged
      ? value.flatMap((range) => {
          const mapped = mapProjectionRange(range, transaction.changes);
          return mapped ? [mapped] : [];
        })
      : [...value];

    for (const effect of transaction.effects) {
      if (!effect.is(revealStructuralSourceEffect)) {
        continue;
      }
      next = effect.value ? [effect.value] : [];
    }

    if (!transaction.selection) {
      return next;
    }

    const selectionRanges = transaction.state.selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
    }));

    return next.filter((range) => selectionRanges.some((selectionRange) => rangeIntersects(selectionRange, range)));
  },
});

const markdownPreviewStateField = StateField.define<DecorationSet>({
  create: (state) => buildDecorationSet(state),
  update: (value, transaction) => {
    if (
      transaction.docChanged ||
      transaction.selection ||
      transaction.effects.some((effect) => effect.is(revealStructuralSourceEffect))
    ) {
      return buildDecorationSet(transaction.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const messageMarkdownPreview = (
  resourceContext: MarkdownPreviewResourceContext = defaultResourceContext,
): Extension => [
  markdownPreviewResourceFacet.of(resourceContext),
  structuralRevealStateField,
  markdownPreviewStateField,
  syntaxHighlighting(markdownHighlightStyle),
  markdownPreviewTheme,
];
