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
