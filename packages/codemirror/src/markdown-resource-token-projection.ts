import { syntaxTree } from "@codemirror/language";
import { Facet, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";

import type { MarkdownProjectionRange } from "./markdown-hybrid-projection";
import { inlineResourceTokenDecoration, resolveInlineResourceReference } from "./markdown-preview-widgets";
import type { MarkdownPreviewTone, MarkdownResourceReference } from "./types";

export type MarkdownResourceTokenTone = MarkdownPreviewTone;

export type MarkdownInlineResourceTokenDecoration = {
  from: number;
  to: number;
  decoration: Decoration;
};

export type MarkdownResourceTokenProjectionContext = {
  resources: readonly MarkdownResourceReference[];
  tone: MarkdownResourceTokenTone;
  onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined;
};

type DynamicMarkdownResourceTokenProjectionContext = Omit<MarkdownResourceTokenProjectionContext, "resources"> & {
  resolveResources: () => readonly MarkdownResourceReference[];
};

type CollectInlineResourceTokenDecorationsInput = MarkdownResourceTokenProjectionContext & {
  excludedRanges?: readonly MarkdownProjectionRange[];
  shouldRevealTokenText?: ((range: MarkdownProjectionRange, state: EditorState) => boolean) | undefined;
};

const defaultMarkdownResourceTokenProjectionContext: DynamicMarkdownResourceTokenProjectionContext = {
  resolveResources: () => [],
  tone: "participant",
  onOpenResource: undefined,
};

const markdownResourceTokenProjectionFacet = Facet.define<
  DynamicMarkdownResourceTokenProjectionContext,
  DynamicMarkdownResourceTokenProjectionContext
>({
  combine: (values) => values.at(-1) ?? defaultMarkdownResourceTokenProjectionContext,
});

export const refreshMarkdownResourceTokenProjectionEffect = StateEffect.define<null>();

const tokenHostTheme = EditorView.baseTheme({
  ".cm-md-resource-token-host": {
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "baseline",
    whiteSpace: "nowrap",
  },
});

const normalizeDecorationRange = (docLength: number, from: number, to: number): { from: number; to: number } | null => {
  const start = Math.max(0, Math.min(from, docLength));
  const end = Math.max(start, Math.min(to, docLength));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return { from: start, to: end };
};

const rangeContains = (ranges: readonly MarkdownProjectionRange[] | undefined, from: number, to: number): boolean =>
  Boolean(ranges?.some((range) => from >= range.from && to <= range.to));

const rangeIntersects = (left: MarkdownProjectionRange, right: MarkdownProjectionRange): boolean => {
  if (left.from === left.to) {
    return left.from >= right.from && left.from <= right.to;
  }
  if (right.from === right.to) {
    return right.from >= left.from && right.from <= left.to;
  }
  return left.from < right.to && left.to > right.from;
};

const selectionIntersectsRange = (range: MarkdownProjectionRange, state: EditorState): boolean =>
  state.selection.ranges.some((selectionRange) =>
    rangeIntersects(range, {
      from: selectionRange.from,
      to: selectionRange.to,
    }),
  );

export const resolveInlineResourceTokenNode = (
  state: EditorState,
  node: SyntaxNodeRef,
  resources: readonly MarkdownResourceReference[],
): MarkdownResourceReference | null => {
  if (node.name !== "Link") {
    return null;
  }

  const label = node.node.getChild("LinkLabel");
  const labelFrom = label?.from ?? node.from;
  const labelTo = label?.to ?? node.to;
  const labelText = state.doc.sliceString(labelFrom, labelTo);
  return resolveInlineResourceReference(resources, labelText);
};

export const collectInlineResourceTokenDecorations = (
  state: EditorState,
  input: CollectInlineResourceTokenDecorationsInput,
): readonly MarkdownInlineResourceTokenDecoration[] => {
  const decorations: MarkdownInlineResourceTokenDecoration[] = [];
  if (input.resources.length === 0) {
    return decorations;
  }

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node: SyntaxNodeRef) => {
      if (rangeContains(input.excludedRanges, node.from, node.to)) {
        return false;
      }
      const resource = resolveInlineResourceTokenNode(state, node, input.resources);
      if (!resource) {
        return undefined;
      }

      const range = { from: node.from, to: node.to };
      if (input.shouldRevealTokenText?.(range, state)) {
        return false;
      }

      decorations.push({
        from: node.from,
        to: node.to,
        decoration: inlineResourceTokenDecoration(resource, input.tone, input.onOpenResource),
      });
      return false;
    },
  });

  return decorations;
};

const buildResourceTokenProjectionSet = (state: EditorState): DecorationSet => {
  const context = state.facet(markdownResourceTokenProjectionFacet);
  const widgets = collectInlineResourceTokenDecorations(state, {
    resources: context.resolveResources(),
    tone: context.tone,
    onOpenResource: context.onOpenResource,
    shouldRevealTokenText: selectionIntersectsRange,
  });
  const docLength = state.doc.length;
  return Decoration.set(
    widgets.flatMap((widget) => {
      const range = normalizeDecorationRange(docLength, widget.from, widget.to);
      return range ? [widget.decoration.range(range.from, range.to)] : [];
    }),
  );
};

const markdownResourceTokenProjectionStateField = StateField.define<DecorationSet>({
  create: (state) => buildResourceTokenProjectionSet(state),
  update: (value, transaction) => {
    if (
      transaction.docChanged ||
      transaction.selection ||
      transaction.effects.some((effect) => effect.is(refreshMarkdownResourceTokenProjectionEffect))
    ) {
      return buildResourceTokenProjectionSet(transaction.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const markdownResourceTokenProjection = (context: DynamicMarkdownResourceTokenProjectionContext): Extension => [
  markdownResourceTokenProjectionFacet.of(context),
  markdownResourceTokenProjectionStateField,
  tokenHostTheme,
];
