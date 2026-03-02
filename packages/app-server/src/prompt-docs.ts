import { PROMPTS as EN_PROMPTS } from "@agenter/i18n-en";

export type PromptSyntax = "md" | "mdx";

export interface PromptDocument {
  syntax: PromptSyntax;
  content: string;
}

export const PROMPT_DOC_KEYS = ["AGENTER", "AGENTER_SYSTEM", "SYSTEM_TEMPLATE", "RESPONSE_CONTRACT"] as const;
export type PromptDocKey = (typeof PROMPT_DOC_KEYS)[number];
export type PromptDocRecord = Record<PromptDocKey, PromptDocument>;

const joinTemplate = (strings: TemplateStringsArray, values: unknown[]): string => {
  let output = "";
  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index] ?? "";
    if (index < values.length) {
      const value = values[index];
      output += value === null || value === undefined ? "" : String(value);
    }
  }
  return output.trim();
};

export const md = (strings: TemplateStringsArray, ...values: unknown[]): PromptDocument => ({
  syntax: "md",
  content: joinTemplate(strings, values),
});

export const mdx = (strings: TemplateStringsArray, ...values: unknown[]): PromptDocument => ({
  syntax: "mdx",
  content: joinTemplate(strings, values),
});

export const DEFAULT_PROMPT_DOCS: PromptDocRecord = {
  AGENTER: { ...EN_PROMPTS.AGENTER },
  AGENTER_SYSTEM: { ...EN_PROMPTS.AGENTER_SYSTEM },
  SYSTEM_TEMPLATE: { ...EN_PROMPTS.SYSTEM_TEMPLATE },
  RESPONSE_CONTRACT: { ...EN_PROMPTS.RESPONSE_CONTRACT },
};
