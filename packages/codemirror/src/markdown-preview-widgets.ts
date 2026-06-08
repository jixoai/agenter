import { StateEffect } from "@codemirror/state";
import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import hljs from "highlight.js";
import { mount, unmount } from "svelte";

import type {
  MarkdownFencedCodeProjection,
  MarkdownProjectionRange,
  MarkdownStructuralProjection,
  MarkdownTableProjection,
} from "./markdown-hybrid-projection";
import MarkdownResourceBar from "./markdown-resource-bar.svelte";
import MarkdownResourceToken from "./markdown-resource-token.svelte";
import type { MarkdownPreviewTone, MarkdownResourceReference } from "./types";

export const revealStructuralSourceEffect = StateEffect.define<MarkdownProjectionRange | null>();
export const openMarkdownResourceEffect = StateEffect.define<string>();

type MountedSvelteExports = Record<string, unknown>;

const FOOTNOTE_REFERENCE_PATTERN = /^\[\^(.+?)\]$/u;

const normalizeResourceLabel = (value: string): string =>
  value.trim().replace(/^\[\^/u, "").replace(/^\^/u, "").replace(/\]$/u, "");

const findResourceByTokenText = (
  resources: readonly MarkdownResourceReference[],
  tokenText: string,
): MarkdownResourceReference | null => {
  const match = FOOTNOTE_REFERENCE_PATTERN.exec(tokenText.trim());
  const label = normalizeResourceLabel(match?.[1] ?? tokenText);
  const resource =
    resources.find(
      (candidate) =>
        normalizeResourceLabel(candidate.tokenText) === label || normalizeResourceLabel(candidate.label) === label,
    ) ?? null;
  return resource;
};

const findResourceByDefinitionLabel = (
  resources: readonly MarkdownResourceReference[],
  label: string,
): MarkdownResourceReference | null => {
  return (
    resources.find((candidate) => normalizeResourceLabel(candidate.label) === normalizeResourceLabel(label)) ?? null
  );
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

class InlineResourceTokenWidget extends WidgetType {
  private component: MountedSvelteExports | null = null;

  constructor(
    private readonly resource: MarkdownResourceReference,
    private readonly tone: MarkdownPreviewTone,
    private readonly onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined,
  ) {
    super();
  }

  override eq(other: InlineResourceTokenWidget): boolean {
    return (
      this.resource.id === other.resource.id && this.tone === other.tone && this.onOpenResource === other.onOpenResource
    );
  }

  override toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "cm-md-resource-token-host";
    this.component = mount(MarkdownResourceToken, {
      target: host,
      props: {
        resource: this.resource,
        tone: this.tone,
        onOpen: () => {
          this.onOpenResource?.(this.resource);
        },
      },
    });
    return host;
  }

  override destroy(): void {
    if (this.component) {
      void unmount(this.component);
      this.component = null;
    }
  }
}

class ResourceBarWidget extends WidgetType {
  private component: MountedSvelteExports | null = null;

  constructor(
    private readonly resources: readonly MarkdownResourceReference[],
    private readonly tone: MarkdownPreviewTone,
    private readonly onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined,
  ) {
    super();
  }

  override eq(other: ResourceBarWidget): boolean {
    return (
      this.tone === other.tone &&
      this.onOpenResource === other.onOpenResource &&
      this.resources.length === other.resources.length &&
      this.resources.every((resource, index) => resource.id === other.resources[index]?.id)
    );
  }

  override toDOM(): HTMLElement {
    const host = document.createElement("div");
    host.className = "cm-md-resource-bar-host";
    this.component = mount(MarkdownResourceBar, {
      target: host,
      props: {
        resources: this.resources,
        tone: this.tone,
        onOpenResource: this.onOpenResource,
      },
    });
    return host;
  }

  override destroy(): void {
    if (this.component) {
      void unmount(this.component);
      this.component = null;
    }
  }
}

const overlayResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

const resolveStructuralFocusPos = (
  view: EditorView,
  projection: MarkdownStructuralProjection,
  event: MouseEvent | TouchEvent,
): number => {
  const point =
    event instanceof MouseEvent
      ? { x: event.clientX, y: event.clientY }
      : event.touches[0]
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
  let pos: number | null = null;
  if (point) {
    try {
      pos = view.posAtCoords(point, false);
    } catch {
      pos = null;
    }
  }

  if (typeof pos === "number" && pos >= projection.from && pos <= projection.to) {
    return pos;
  }

  return projection.from;
};

const focusStructuralSource =
  (view: EditorView, projection: MarkdownStructuralProjection) =>
  (event: MouseEvent | TouchEvent): void => {
    // 2026-04-23 user guidance: focusing a structural preview must already reveal raw source.
    // Requiring a drag to start selection broke the intended inspect/copy workflow.
    const anchor = resolveStructuralFocusPos(view, projection, event);
    event.preventDefault();
    view.focus();
    view.dispatch({
      effects: revealStructuralSourceEffect.of({
        from: projection.from,
        to: projection.to,
      }),
      selection: { anchor, head: anchor },
      scrollIntoView: true,
    });
  };

const applyStructuralGeometry = (root: HTMLElement, projection: MarkdownStructuralProjection): void => {
  root.style.setProperty("--md-structural-line-count", String(projection.sourceLineCount));
  root.style.setProperty(
    "--md-structural-height",
    `calc(var(--md-source-line-height) * ${projection.sourceLineCount})`,
  );

  if (projection.kind === "table") {
    root.style.setProperty(
      "--md-structural-table-row-count",
      String(Math.max(1, projection.headerRowCount + projection.bodyRowCount)),
    );
    return;
  }

  root.style.setProperty("--md-structural-code-line-count", String(Math.max(1, projection.codeLineCount)));
};

const syncMeasuredStructuralGeometry = (
  root: HTMLElement,
  view: EditorView,
  projection: MarkdownStructuralProjection,
): void => {
  view.requestMeasure({
    read: (measuredView) => {
      const start = measuredView.lineBlockAt(projection.from);
      const end = measuredView.lineBlockAt(Math.max(projection.from, projection.to - 1));
      return Math.max(start.height, end.bottom - start.top);
    },
    write: (height) => {
      root.style.setProperty("--md-structural-height", `${Math.max(height, 1)}px`);
    },
  });
};

const renderTableProjection = (projection: MarkdownTableProjection): HTMLElement => {
  const overlay = document.createElement("div");
  overlay.className = "cm-md-structural-overlay-surface cm-md-structural-table-surface";

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
  overlay.append(scroll);
  return overlay;
};

const renderCodeBlockProjection = (projection: MarkdownFencedCodeProjection): HTMLElement => {
  const overlay = document.createElement("div");
  overlay.className = `cm-md-structural-overlay-surface cm-md-structural-code-surface${
    projection.hasLanguage ? " cm-md-structural-code-surface-labeled" : ""
  }`;

  const block = document.createElement("div");
  block.className = "cm-md-structural-codeblock";

  if (projection.hasLanguage) {
    const header = document.createElement("div");
    header.className = "cm-md-structural-codeheader";
    header.textContent = projection.language.length > 0 ? projection.language : projection.rawInfo;
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
  overlay.append(block);
  return overlay;
};

class StructuralProjectionOverlayWidget extends WidgetType {
  private readonly key: string;

  constructor(private readonly projection: MarkdownStructuralProjection) {
    super();
    this.key =
      projection.kind === "table"
        ? `table:${projection.from}:${projection.to}:${projection.sourceLineCount}:${projection.rows
            .map((row) => `${row.kind}:${row.cells.join("\u241f")}`)
            .join("\u241e")}`
        : `fenced-code:${projection.from}:${projection.to}:${projection.sourceLineCount}:${projection.language}:${projection.code}`;
  }

  override eq(other: StructuralProjectionOverlayWidget): boolean {
    return this.key === other.key;
  }

  override ignoreEvent(): boolean {
    return true;
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement("span");
    root.className = `cm-md-structural-overlay cm-md-structural-${this.projection.kind}`;
    root.dataset.markdownStructural = this.projection.kind;
    applyStructuralGeometry(root, this.projection);
    syncMeasuredStructuralGeometry(root, view, this.projection);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        syncMeasuredStructuralGeometry(root, view, this.projection);
      });
      observer.observe(view.scrollDOM);
      overlayResizeObservers.set(root, observer);
    }

    if (this.projection.kind === "table") {
      const table = renderTableProjection(this.projection);
      table.addEventListener("mousedown", focusStructuralSource(view, this.projection));
      table.addEventListener("touchstart", focusStructuralSource(view, this.projection), { passive: false });
      root.append(table);
      return root;
    }

    const codeBlock = renderCodeBlockProjection(this.projection);
    codeBlock.addEventListener("mousedown", focusStructuralSource(view, this.projection));
    codeBlock.addEventListener("touchstart", focusStructuralSource(view, this.projection), { passive: false });
    root.append(codeBlock);
    return root;
  }

  override destroy(dom: HTMLElement): void {
    overlayResizeObservers.get(dom)?.disconnect();
    overlayResizeObservers.delete(dom);
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

export const structuralOverlayDecoration = (projection: MarkdownStructuralProjection) =>
  Decoration.widget({
    side: -1,
    widget: new StructuralProjectionOverlayWidget(projection),
  });

export const inlineResourceTokenDecoration = (
  resource: MarkdownResourceReference,
  tone: MarkdownPreviewTone,
  onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined,
) =>
  Decoration.replace({
    inclusive: false,
    widget: new InlineResourceTokenWidget(resource, tone, onOpenResource),
  });

export const resourceBarDecoration = (
  resources: readonly MarkdownResourceReference[],
  tone: MarkdownPreviewTone,
  onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined,
) =>
  Decoration.widget({
    side: 1,
    block: true,
    widget: new ResourceBarWidget(resources, tone, onOpenResource),
  });

export const resolveInlineResourceReference = findResourceByTokenText;
export const resolveDefinitionResourceReference = findResourceByDefinitionLabel;
