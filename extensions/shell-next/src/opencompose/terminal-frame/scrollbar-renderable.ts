import { ScrollBarRenderable, type RenderContext } from "@opentui/core";

type OpenTuiScrollbarOptions = ConstructorParameters<typeof ScrollBarRenderable>[1];

export interface OpenComposeScrollbarState {
  scrollSize: number;
  viewportSize: number;
  scrollPosition: number;
}

export interface OpenComposeScrollbarOptions extends Omit<OpenTuiScrollbarOptions, "onChange"> {
  onBackendChange?: (position: number) => void;
  backendState?: OpenComposeScrollbarState;
}

const resolveMaxPosition = (state: Pick<OpenComposeScrollbarState, "scrollSize" | "viewportSize">): number =>
  Math.max(0, Math.trunc(state.scrollSize) - Math.trunc(state.viewportSize));

const normalizePosition = (position: number, maxPosition: number): number => {
  const safePosition = Math.trunc(position);
  return Number.isFinite(safePosition) ? Math.max(0, Math.min(maxPosition, safePosition)) : 0;
};

export class OpenComposeScrollbarRenderable extends ScrollBarRenderable {
  #syncingFromProps = false;
  #onChange: ((position: number) => void) | undefined;
  #latestBackendPosition = 0;

  constructor(ctx: RenderContext, options: OpenComposeScrollbarOptions) {
    let forwardChange: ((position: number) => void) | undefined;
    const {
      backendState,
      onBackendChange,
      orientation,
      showArrows,
      arrowOptions,
      trackOptions,
      ...layoutOptions
    } = options;
    const scrollbarOptions: OpenTuiScrollbarOptions = {
      ...layoutOptions,
      orientation,
      showArrows,
      arrowOptions,
      trackOptions,
      onChange: (position) => {
        forwardChange?.(position);
      },
    };
    super(ctx, {
      ...scrollbarOptions,
    });
    this.#onChange = onBackendChange;
    forwardChange = (position) => {
      if (this.#syncingFromProps) {
        return;
      }
      const maxPosition = resolveMaxPosition({
        scrollSize: this.scrollSize,
        viewportSize: this.viewportSize,
      });
      const normalizedPosition = normalizePosition(position, maxPosition);
      if (normalizedPosition === this.#latestBackendPosition) {
        this.scrollPosition = this.#latestBackendPosition;
        return;
      }
      this.scrollPosition = this.#latestBackendPosition;
      this.#onChange?.(normalizedPosition);
    };
    if (backendState) {
      this.applyBackendState(backendState);
    }
  }

  applyBackendState(options: OpenComposeScrollbarState): void {
    this.#syncingFromProps = true;
    try {
      this.scrollSize = options.scrollSize;
      this.viewportSize = options.viewportSize;
      const maxPosition = resolveMaxPosition(options);
      const backendPosition = normalizePosition(options.scrollPosition, maxPosition);
      this.#latestBackendPosition = backendPosition;
      this.scrollPosition = backendPosition;
    } finally {
      this.#syncingFromProps = false;
    }
  }

  set backendState(value: OpenComposeScrollbarState | undefined) {
    if (!value) {
      return;
    }
    this.applyBackendState(value);
  }

  set onBackendChange(handler: ((position: number) => void) | undefined) {
    this.#onChange = handler;
  }

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    if (this.#syncingFromProps && event === "change") {
      return false;
    }
    return super.emit(event, ...args);
  }

  override scrollBy(delta: number, unit?: Parameters<ScrollBarRenderable["scrollBy"]>[1]): void {
    super.scrollBy(delta, unit);
  }

  get latestBackendPosition(): number {
    return this.#latestBackendPosition;
  }

  get visibleProgressState(): { min: number; max: number; value: number; viewportSize: number } {
    return {
      min: this.slider.min,
      max: this.slider.max,
      value: this.slider.value,
      viewportSize: this.slider.viewPortSize,
    };
  }
}
