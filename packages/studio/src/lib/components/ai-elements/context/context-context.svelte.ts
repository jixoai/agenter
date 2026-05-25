import { getContext, setContext } from "svelte";

export const PERCENT_MAX = 100;
export const ICON_RADIUS = 10;
export const ICON_VIEWBOX = 24;
export const ICON_CENTER = 12;
export const ICON_STROKE_WIDTH = 2;

export type LanguageModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
};

export type ModelId = string;

export type ContextSchema = {
  usedTokens: number | null;
  maxTokens: number | null;
  usage?: LanguageModelUsage;
  modelId?: ModelId | null;
  estimatedCostLabel?: string | null;
};

const TOKEN_NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export const formatTokenCount = (value: number): string => TOKEN_NUMBER_FORMAT.format(value);

export class ContextClass {
  usedTokens = $state<number | null>(null);
  maxTokens = $state<number | null>(null);
  usage = $state<LanguageModelUsage | undefined>(undefined);
  modelId = $state<ModelId | null | undefined>(undefined);
  estimatedCostLabel = $state<string | null>(null);

  constructor(props: ContextSchema) {
    this.usedTokens = props.usedTokens;
    this.maxTokens = props.maxTokens;
    this.usage = props.usage;
    this.modelId = props.modelId;
    this.estimatedCostLabel = props.estimatedCostLabel ?? null;
  }

  get usedPercent() {
    if (!this.hasProgressMeter) {
      return 0;
    }
    return (this.usedTokens ?? 0) / (this.maxTokens ?? 1);
  }

  get hasProgressMeter() {
    return Number.isFinite(this.maxTokens) && (this.maxTokens ?? 0) > 0 && Number.isFinite(this.usedTokens);
  }

  get displayPercent() {
    if (!this.hasProgressMeter) {
      return "—";
    }
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(this.usedPercent);
  }

  get usedTokensFormatted() {
    if (!Number.isFinite(this.usedTokens)) {
      return "—";
    }
    return formatTokenCount(this.usedTokens ?? 0);
  }

  get maxTokensFormatted() {
    const maxTokens = this.maxTokens;
    if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens) || maxTokens <= 0) {
      return "—";
    }
    return formatTokenCount(maxTokens);
  }

  get circumference() {
    return 2 * Math.PI * ICON_RADIUS;
  }

  get dashOffset() {
    return this.circumference * (1 - this.usedPercent);
  }
}

const CONTEXT_KEY = Symbol.for("agenter-ext-studio/ai-elements/context");

export function setContextValue(contextInstance: ContextClass) {
  setContext(CONTEXT_KEY, contextInstance);
}

export function getContextValue(): ContextClass {
  const context = getContext<ContextClass>(CONTEXT_KEY);

  if (!context) {
    throw new Error("Context components must be used within Context");
  }

  return context;
}
