type ClassValue = string | false | null | undefined;

export const cn = (...inputs: readonly ClassValue[]): string => inputs.filter(Boolean).join(" ");

const infoAliases: Record<string, string> = {
  yml: "yaml",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  shellscript: "bash",
  console: "bash",
  env: "bash",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  tsx: "tsx",
  json5: "json",
  jsonc: "json",
  mdx: "markdown",
  text: "plaintext",
  txt: "plaintext",
};

export const normalizeMarkdownCodeLanguage = (input: string): string => {
  const token = input.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (token.length === 0) {
    return "";
  }
  const base = token.split("+")[0] ?? token;
  return infoAliases[base] ?? base;
};
