import hljs from "highlight.js";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

import type { MarkdownFencedCodeProjection, MarkdownStructuralProjection, MarkdownTableProjection } from "./message-markdown-hybrid-projection";

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

const createProjectionSelectionHandler =
  (view: EditorView, projection: MarkdownStructuralProjection) =>
  (event: Event): void => {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }
    event.preventDefault();
    view.focus();
    view.dispatch({
      selection: {
        anchor: projection.from,
        head: projection.to,
      },
      scrollIntoView: true,
    });
  };

const renderTableProjection = (projection: MarkdownTableProjection): HTMLElement => {
  const scroll = document.createElement("div");
  scroll.className = "cm-md-structural-table-scroll";
  scroll.dataset.markdownOverflow = "x";

  const table = document.createElement("table");
  table.className = "cm-md-structural-table";

  const headerRows = projection.rows.filter((row) => row.kind === "header");
  const bodyRows = projection.rows.filter((row) => row.kind === "body");

  if (headerRows.length > 0) {
    const thead = document.createElement("thead");
    for (const row of headerRows) {
      const tr = document.createElement("tr");
      for (const cell of row.cells) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = cell;
        tr.append(th);
      }
      thead.append(tr);
    }
    table.append(thead);
  }

  if (bodyRows.length > 0) {
    const tbody = document.createElement("tbody");
    for (const row of bodyRows) {
      const tr = document.createElement("tr");
      for (const cell of row.cells) {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
  }

  scroll.append(table);
  return scroll;
};

const renderCodeBlockProjection = (projection: MarkdownFencedCodeProjection): HTMLElement => {
  const block = document.createElement("div");
  block.className = "cm-md-structural-codeblock";

  if (projection.language.length > 0) {
    const header = document.createElement("div");
    header.className = "cm-md-structural-codeheader";
    header.textContent = projection.language;
    block.append(header);
  }

  const scroll = document.createElement("div");
  scroll.className = "cm-md-structural-code-scroll";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "cm-md-structural-code";
  code.dataset.language = projection.language || "text";

  if (projection.language.length > 0 && hljs.getLanguage(projection.language)) {
    code.classList.add("hljs", `language-${projection.language}`);
    code.innerHTML = hljs.highlight(projection.code, {
      ignoreIllegals: true,
      language: projection.language,
    }).value;
  } else {
    code.textContent = projection.code;
  }

  pre.append(code);
  scroll.append(pre);
  block.append(scroll);
  return block;
};

class StructuralProjectionWidget extends WidgetType {
  private readonly key: string;

  constructor(private readonly projection: MarkdownStructuralProjection) {
    super();
    this.key =
      projection.kind === "table"
        ? `table:${projection.from}:${projection.to}:${projection.rows
            .map((row) => `${row.kind}:${row.cells.join("\u241f")}`)
            .join("\u241e")}`
        : `fenced-code:${projection.from}:${projection.to}:${projection.language}:${projection.code}`;
  }

  override eq(other: StructuralProjectionWidget): boolean {
    return this.key === other.key;
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement("div");
    root.className = `cm-md-structural-block cm-md-structural-${this.projection.kind}`;
    root.dataset.markdownStructural = this.projection.kind;
    root.addEventListener("mousedown", createProjectionSelectionHandler(view, this.projection));
    root.addEventListener("touchstart", createProjectionSelectionHandler(view, this.projection), { passive: false });

    if (this.projection.kind === "table") {
      root.append(renderTableProjection(this.projection));
      return root;
    }

    root.append(renderCodeBlockProjection(this.projection));
    return root;
  }
}

export const orderedDecoration = (label: number, faded: boolean) =>
  Decoration.replace({
    inclusive: false,
    widget: new OrderedListNumberWidget(label, faded),
  });

export const bulletDecoration = (faded: boolean) =>
  Decoration.replace({
    inclusive: false,
    widget: new BulletWidget(faded),
  });

export const taskMarkerDecoration = (checked: boolean) =>
  Decoration.replace({
    inclusive: false,
    widget: new TaskCheckboxWidget(checked),
  });

export const structuralDecoration = (projection: MarkdownStructuralProjection) =>
  Decoration.replace({
    block: true,
    inclusive: false,
    widget: new StructuralProjectionWidget(projection),
  });
