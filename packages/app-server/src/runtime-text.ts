import type { RuntimeTextCatalog, RuntimeTextId } from "@agenter/i18n-core";
import { RUNTIME_TEXTS as EN_RUNTIME_TEXTS } from "@agenter/i18n-en";
import { RUNTIME_TEXTS as ZH_HANS_RUNTIME_TEXTS } from "@agenter/i18n-zh-hans";

export type RuntimeLocale = "en" | "zh-Hans";
export type TaskSummaryState = "has_user_reply" | "has_clean_text" | "thinking_only" | "done" | "stage_fallback";

const MESSAGES: Record<RuntimeLocale, RuntimeTextCatalog> = {
  en: EN_RUNTIME_TEXTS,
  "zh-Hans": ZH_HANS_RUNTIME_TEXTS,
};

const normalizeLocale = (locale?: string): RuntimeLocale =>
  locale && locale.toLowerCase().startsWith("zh") ? "zh-Hans" : "en";

const applyParams = (template: string, params?: Record<string, string | number>): string =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = params?.[key];
    return value === undefined ? "" : String(value);
  });

export const resolveTaskSummaryState = (input: {
  toUserReplies: string[];
  cleanText: string;
  selfTalk: string;
  done: boolean;
}): TaskSummaryState => {
  if (input.toUserReplies.length > 0) {
    return "has_user_reply";
  }
  if (input.cleanText.trim().length > 0) {
    return "has_clean_text";
  }
  if (input.selfTalk.trim().length > 0) {
    return "thinking_only";
  }
  if (input.done) {
    return "done";
  }
  return "stage_fallback";
};

export const createRuntimeText = (locale?: string) => {
  const resolved = normalizeLocale(locale);
  const catalog = MESSAGES[resolved];
  return {
    locale: resolved,
    t: (id: RuntimeTextId, params?: Record<string, string | number>): string => applyParams(catalog[id], params),
  };
};
