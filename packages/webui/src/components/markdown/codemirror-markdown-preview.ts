import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import { tags as t } from "@lezer/highlight";

const HIDDEN_TOKENS = ["HeaderMark", "EmphasisMark", "LinkMark", "URL", "HardBreak", "QuoteMark", "ListMark"];

const hiddenDecoration = Decoration.mark({ class: "cm-md-hidden" });
const codeBlockLine = Decoration.line({ class: "cm-md-codeblock-line" });
const codeBlockStart = Decoration.line({ class: "cm-md-codeblock-line-start" });
const codeBlockEnd = Decoration.line({ class: "cm-md-codeblock-line-end" });
const codeBlockInactive = Decoration.line({ class: "cm-md-codeblock-inactive" });
const blockquoteLine = Decoration.line({ class: "cm-md-blockquote-line" });
const linkDecoration = Decoration.mark({ class: "cm-md-link" });
const imageDecoration = Decoration.mark({ class: "cm-md-image" });
const fadedDecoration = Decoration.mark({ class: "cm-md-faded" });
const taskFadedDecoration = Decoration.mark({ class: "cm-md-task-faded" });

const normalizeDecorationRange = (docLength: number, from: number, to: number): { from: number; to: number } | null => {
  const start = Math.max(0, Math.min(from, docLength));
  const end = Math.max(start, Math.min(to, docLength));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return { from: start, to: end };
};

class OrderedListNumberWidget extends WidgetType {
  constructor(
    private readonly label: number,
    private readonly faded: boolean,
  ) {
    super();
  }

  override eq(other: OrderedListNumberWidget): boolean {
    return this.label === other.label && this.faded === other.faded;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = `${this.label}.`;
    span.className = `cm-md-olist${this.faded ? " cm-md-olist-faded" : ""}`;
    return span;
  }
}

class BulletWidget extends WidgetType {
  constructor(private readonly faded: boolean) {
    super();
  }

  override eq(other: BulletWidget): boolean {
    return this.faded === other.faded;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = "•";
    span.className = `cm-md-ulmark${this.faded ? " cm-md-olist-faded" : ""}`;
    return span;
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  override eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked;
  }

  override toDOM(): HTMLElement {
    const box = document.createElement("span");
    box.className = `cm-md-task ${this.checked ? "cm-md-task-checked" : ""}`;
    box.ariaHidden = "true";
    return box;
  }
}

class CodeInfoWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  override eq(other: CodeInfoWidget): boolean {
    return this.label === other.label;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-md-codeinfo";
    span.textContent = this.label;
    span.ariaHidden = "true";
    return span;
  }
}

const orderedDecoration = (label: number, faded: boolean) =>
  Decoration.replace({
    widget: new OrderedListNumberWidget(label, faded),
    inclusive: false,
  });

const applyCodeBlockLines = (
  view: EditorView,
  node: SyntaxNodeRef,
  widgets: Array<{ from: number; to: number; decoration: Decoration }>,
  isSelected: boolean,
) => {
  const firstLine = view.state.doc.lineAt(node.from).number;
  const lastLine = view.state.doc.lineAt(node.to).number;
  const hasClosingFence = node.to - node.from > 3 && view.state.doc.sliceString(node.to - 3, node.to) === "```";

  for (let lineNo = firstLine; lineNo <= lastLine; lineNo += 1) {
    const line = view.state.doc.line(lineNo);
    widgets.push({ from: line.from, to: line.from, decoration: codeBlockLine });
    if (lineNo === firstLine) {
      widgets.push({ from: line.from, to: line.from, decoration: codeBlockStart });
      if (!isSelected && hasClosingFence) {
        widgets.push({ from: line.from, to: line.from, decoration: codeBlockInactive });
      }
    }
    if (lineNo === lastLine) {
      widgets.push({ from: line.from, to: line.from, decoration: codeBlockEnd });
    }
  }
};

const applyBlockquoteLines = (
  view: EditorView,
  node: SyntaxNodeRef,
  widgets: Array<{ from: number; to: number; decoration: Decoration }>,
  lineStarts: Set<number>,
) => {
  const firstLine = view.state.doc.lineAt(node.from).number;
  const lastLine = view.state.doc.lineAt(node.to).number;

  for (let lineNo = firstLine; lineNo <= lastLine; lineNo += 1) {
    const line = view.state.doc.line(lineNo);
    if (lineStarts.has(line.from)) {
      continue;
    }
    lineStarts.add(line.from);
    widgets.push({ from: line.from, to: line.from, decoration: blockquoteLine });
  }
};

class MarkdownPreviewPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    const widgets: Array<{ from: number; to: number; decoration: Decoration }> = [];
    const selectionRanges = view.state.selection.ranges;
    const selectedLines = selectionRanges.map((range) => {
      const lineFrom = view.state.doc.lineAt(range.from);
      const lineTo = view.state.doc.lineAt(range.to);
      return { from: Math.min(lineFrom.from, lineTo.from), to: Math.max(lineFrom.to, lineTo.to) };
    });
    const listStack: number[] = [];
    const blockquoteLineStarts = new Set<number>();

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node: SyntaxNodeRef) => {
          const name = node.type.name;
          const isSelectedLine = selectedLines.some((range) => node.from < range.to && node.to > range.from);
          const parentName = node.node.parent?.name ?? "";
          const grandName = node.node.parent?.parent?.name ?? "";
          const isOrderedList = parentName.includes("OrderedList") || grandName.includes("OrderedList");
          const text = view.state.doc.sliceString(node.from, node.to);

          if (name === "OrderedList") {
            listStack.push(1);
            return;
          }

          if (name === "FencedCode") {
            const overlapsSelection = selectedLines.some((range) => node.from < range.to && node.to > range.from);
            applyCodeBlockLines(view, node, widgets, overlapsSelection);
            return;
          }

          if (name === "Blockquote") {
            applyBlockquoteLines(view, node, widgets, blockquoteLineStarts);
          }

          if (name === "Link") {
            const label = node.node.getChild("LinkLabel");
            if (label) {
              widgets.push({ from: label.from, to: label.to, decoration: linkDecoration });
            }
          }

          if (name === "Image") {
            widgets.push({ from: node.from, to: node.to, decoration: imageDecoration });
          }

          if (name === "ListMark") {
            if (isOrderedList) {
              const current = listStack[listStack.length - 1] ?? 1;
              widgets.push({
                from: node.from,
                to: node.to,
                decoration: isSelectedLine ? fadedDecoration : orderedDecoration(current, false),
              });
              if (listStack.length > 0) {
                listStack[listStack.length - 1] = current + 1;
              }
              return;
            }
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: isSelectedLine
                ? fadedDecoration
                : Decoration.replace({ widget: new BulletWidget(false), inclusive: false }),
            });
            return;
          }

          if (name === "TaskMarker") {
            const checked = /\[[xX]\]/.test(text);
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: isSelectedLine
                ? taskFadedDecoration
                : Decoration.replace({ widget: new TaskCheckboxWidget(checked), inclusive: false }),
            });
            return;
          }

          if (name === "CodeMark") {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: isSelectedLine ? fadedDecoration : hiddenDecoration,
            });
            return;
          }

          if (name === "CodeInfo") {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: isSelectedLine
                ? fadedDecoration
                : Decoration.replace({
                    widget: new CodeInfoWidget(text.trim()),
                    inclusive: false,
                  }),
            });
            return;
          }

          if (name === "HeaderMark") {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: isSelectedLine ? fadedDecoration : hiddenDecoration,
            });
            return;
          }

          if (HIDDEN_TOKENS.includes(name)) {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: isSelectedLine ? fadedDecoration : hiddenDecoration,
            });
          }
        },
        leave: (node) => {
          if (node.name === "OrderedList") {
            listStack.pop();
          }
        },
      });
    }

    widgets.sort((left, right) => left.from - right.from || left.to - right.to);
    const docLength = view.state.doc.length;
    return Decoration.set(
      widgets.flatMap((widget) => {
        const range = normalizeDecorationRange(docLength, widget.from, widget.to);
        return range ? [widget.decoration.range(range.from, range.to)] : [];
      }),
    );
  }
}

const markdownPreviewPlugin = ViewPlugin.fromClass(MarkdownPreviewPlugin, {
  decorations: (view) => view.decorations,
});

const markdownHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: "var(--md-heading)", fontWeight: "700", fontSize: "1.18em", lineHeight: "1.35" },
  { tag: t.heading2, color: "var(--md-heading)", fontWeight: "700", fontSize: "1.12em", lineHeight: "1.35" },
  { tag: t.heading3, color: "var(--md-heading)", fontWeight: "700", fontSize: "1.06em", lineHeight: "1.35" },
  { tag: [t.heading4, t.heading5], color: "var(--md-heading)", fontWeight: "700" },
  { tag: t.heading6, color: "var(--md-quote)", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.link, color: "var(--md-link)", textDecoration: "underline" },
  {
    tag: t.monospace,
    color: "var(--md-inline-code)",
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--md-inline-code-bg)",
    border: "1px solid var(--md-inline-code-border)",
    borderRadius: "6px",
    padding: "1px 4px",
  },
  { tag: t.quote, color: "var(--md-quote)", fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier], color: "var(--md-keyword)", fontWeight: "600" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--md-string)" },
  { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: "var(--md-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--md-comment)", fontStyle: "italic" },
  { tag: [t.typeName, t.className, t.namespace, t.labelName], color: "var(--md-type)", fontWeight: "600" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)],
    color: "var(--md-function)",
  },
  { tag: [t.propertyName, t.attributeName], color: "var(--md-property)" },
  { tag: [t.operator, t.punctuation, t.separator, t.brace, t.squareBracket, t.paren], color: "var(--md-operator)" },
  { tag: [t.meta, t.processingInstruction], color: "var(--md-comment)" },
]);

const markdownPreviewTheme = EditorView.baseTheme({
  ".cm-md-hidden": { display: "none" },
  ".cm-line": { position: "relative" },
  ".cm-md-codeblock-line": {
    backgroundColor: "var(--md-code-bg)",
    borderInline: "1px solid var(--md-code-border)",
    color: "var(--md-code-text)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.94em",
    paddingInline: "10px",
  },
  ".cm-md-codeblock-line-start": {
    borderTopLeftRadius: "10px",
    borderTopRightRadius: "10px",
    borderTop: "1px solid var(--md-code-border)",
    paddingTop: "8px",
  },
  ".cm-md-codeblock-line-end": {
    borderBottomLeftRadius: "10px",
    borderBottomRightRadius: "10px",
    borderBottom: "1px solid var(--md-code-border)",
    paddingBottom: "8px",
    marginBottom: "8px",
  },
  ".cm-md-codeblock-inactive": { opacity: 0.72 },
  ".cm-md-codeinfo": {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "1.4rem",
    borderRadius: "999px",
    backgroundColor: "color-mix(in srgb, var(--md-code-border) 18%, transparent)",
    color: "var(--md-code-label)",
    fontSize: "0.78em",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "0.08rem 0.45rem",
    textTransform: "uppercase",
  },
  ".cm-md-link": { color: "var(--md-link)", textDecoration: "underline", cursor: "pointer" },
  ".cm-md-image": { display: "inline-block" },
  ".cm-md-olist": {
    color: "var(--md-quote)",
    paddingRight: "0.35em",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-md-olist.cm-md-olist-faded": { color: "var(--md-comment)" },
  ".cm-md-faded": { color: "var(--md-comment)", opacity: 0.7 },
  ".cm-md-task": {
    display: "inline-block",
    width: "0.95em",
    height: "0.95em",
    borderRadius: "3px",
    border: "1px solid var(--md-code-border)",
    marginRight: "0.35em",
    background: "color-mix(in srgb, white 80%, transparent)",
  },
  ".cm-md-task-checked": {
    background: "color-mix(in srgb, var(--md-link) 35%, transparent)",
    borderColor: "color-mix(in srgb, var(--md-link) 60%, transparent)",
    position: "relative",
  },
  ".cm-md-task-checked::after": {
    content: '""',
    position: "absolute",
    inset: "0.6px 3px 2.4px 3px",
    borderBottom: "2px solid white",
    borderRight: "2px solid white",
    transform: "rotate(35deg)",
    opacity: 0.9,
  },
  ".cm-md-task-faded": { opacity: 0.55 },
  ".cm-md-ulmark": { color: "var(--md-heading)", fontWeight: 700, paddingRight: "0.2em" },
  ".cm-md-blockquote-line": {
    borderLeft: "3px solid color-mix(in srgb, var(--md-quote) 45%, transparent)",
    paddingLeft: "12px",
  },
});

export const markdownPreview = (): Extension => {
  return [markdownPreviewPlugin, syntaxHighlighting(markdownHighlightStyle), markdownPreviewTheme];
};
