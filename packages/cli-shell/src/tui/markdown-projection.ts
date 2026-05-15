import { EventEmitter } from "events";

import {
  BoxRenderable,
  InternalKeyHandler,
  KeyHandler,
  MarkdownRenderable,
  OptimizedBuffer,
  RGBA,
  Renderable,
  RootRenderable,
  SyntaxStyle,
  type RenderContext,
} from "@opentui/core";

import { fitTerminalText } from "./cell-width";

const MAX_RENDER_PASSES = 8;

class OffscreenRenderContext extends EventEmitter implements RenderContext {
  width: number;
  height: number;
  frameId = 0;
  widthMethod = "unicode" as const;
  capabilities = null;
  hasSelection = false;
  currentFocusedRenderable: Renderable | null = null;
  currentFocusedEditor = null;
  keyInput = new KeyHandler();
  _internalKeyInput = new InternalKeyHandler();

  readonly #lifecyclePasses = new Set<Renderable>();

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }

  addToHitGrid = (): void => {};
  pushHitGridScissorRect = (): void => {};
  popHitGridScissorRect = (): void => {};
  clearHitGridScissorRects = (): void => {};
  requestRender = (): void => {};
  setCursorPosition = (): void => {};
  setCursorStyle = (): void => {};
  setCursorColor = (_color: RGBA): void => {};
  setMousePointer = (): void => {};
  requestLive = (): void => {};
  dropLive = (): void => {};
  getSelection = () => null;
  requestSelectionUpdate = (): void => {};
  focusRenderable = (renderable: Renderable): void => {
    this.currentFocusedRenderable = renderable;
  };
  blurRenderable = (renderable: Renderable): void => {
    if (this.currentFocusedRenderable === renderable) {
      this.currentFocusedRenderable = null;
    }
  };
  claimFirstLineOffset = (): number => 0;
  registerLifecyclePass = (renderable: Renderable): void => {
    this.#lifecyclePasses.add(renderable);
  };
  unregisterLifecyclePass = (renderable: Renderable): void => {
    this.#lifecyclePasses.delete(renderable);
  };
  getLifecyclePasses = (): Set<Renderable> => this.#lifecyclePasses;
  clearSelection = (): void => {};
  startSelection = (): void => {};
  updateSelection = (): void => {};
}

const extractLastRenderedLine = (buffer: OptimizedBuffer, width: number): string => {
  const renderedLines = buffer
    .getSpanLines()
    .map((line) => line.spans.map((span) => span.text).join(""));
  const renderedLine = [...renderedLines].reverse().find((line) => line.trim().length > 0) ?? "";
  return fitTerminalText(renderedLine, width);
};

const collectHighlightingRenderables = (renderable: Renderable): Renderable[] => {
  const pending: Renderable[] = [];
  if ("isHighlighting" in renderable && "highlightingDone" in renderable) {
    pending.push(renderable);
  }
  for (const child of renderable.getChildren()) {
    if (child instanceof Renderable) {
      pending.push(...collectHighlightingRenderables(child));
    }
  }
  return pending;
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as { then?: unknown }).then === "function";

export const projectMarkdownLastLine = async (input: {
  content: string;
  width: number;
}): Promise<string> => {
  const width = Math.max(0, input.width);
  if (width <= 0) {
    return "";
  }

  const context = new OffscreenRenderContext(width, 1);
  const syntaxStyle = SyntaxStyle.create();
  const root = new RootRenderable(context);
  const surface = new BoxRenderable(context, {
    id: "cli-shell-markdown-projection-root",
    position: "absolute",
    left: 0,
    top: 0,
    width,
    height: "auto",
    border: false,
    backgroundColor: "transparent",
    shouldFill: false,
    flexDirection: "column",
  });
  const markdown = new MarkdownRenderable(context, {
    content: input.content,
    syntaxStyle,
    width,
  });
  const buffer = OptimizedBuffer.create(width, 1, context.widthMethod, {
    id: "cli-shell-markdown-projection",
  });

  root.add(surface);
  surface.add(markdown);

  try {
    let targetHeight = 1;
    for (let pass = 0; pass < MAX_RENDER_PASSES; pass += 1) {
      context.width = width;
      context.height = targetHeight;
      root.resize(width, targetHeight);
      buffer.resize(width, targetHeight);
      buffer.clear();
      context.frameId += 1;
      root.render(buffer, 0);

      const measuredHeight = Math.max(1, surface.height);
      if (measuredHeight === targetHeight) {
        break;
      }
      targetHeight = measuredHeight;
    }

    const pending = collectHighlightingRenderables(surface).filter(
      (renderable): renderable is Renderable & { highlightingDone: Promise<void> } =>
        "highlightingDone" in renderable && isPromiseLike(renderable.highlightingDone),
    );
    if (pending.length > 0) {
      await Promise.all(pending.map((renderable) => renderable.highlightingDone));
      context.width = width;
      context.height = Math.max(1, surface.height);
      root.resize(width, context.height);
      buffer.resize(width, context.height);
      buffer.clear();
      context.frameId += 1;
      root.render(buffer, 0);
    }

    return extractLastRenderedLine(buffer, width);
  } finally {
    root.destroyRecursively();
    buffer.destroy();
    syntaxStyle.destroy();
  }
};
