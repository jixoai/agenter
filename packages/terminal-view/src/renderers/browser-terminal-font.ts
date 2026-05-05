import type { TerminalFontProfile } from "../terminal-renderer-profile";

const waitForAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

const splitFontFamilyStack = (input: string): string[] => {
  const families: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      const normalized = current.trim();
      if (normalized.length > 0) {
        families.push(normalized);
      }
      current = "";
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    families.push(tail);
  }
  return families;
};

export const resolvePrimaryTerminalFontFamily = (input: string): string => {
  const primary = splitFontFamilyStack(input)[0];
  return primary && primary.length > 0 ? primary : "monospace";
};

export const resolveTerminalFontSignature = (font: TerminalFontProfile): string =>
  [
    font.family,
    String(font.sizePx),
    String(font.lineHeight),
    String(font.letterSpacing),
    font.weight,
    font.weightBold,
    font.ligatures ? "liga-on" : "liga-off",
  ].join("|");

// `document.fonts.check()` is not sufficient here. It only answers whether a
// face matches the descriptor, not whether the browser has actually fetched the
// webfont we need before terminal metric measurement.
export const waitForBrowserTerminalFont = async (font: Pick<TerminalFontProfile, "family" | "sizePx" | "weight">) => {
  if (typeof document === "undefined") {
    return;
  }
  const fonts = document.fonts;
  if (!fonts) {
    await waitForAnimationFrame();
    return;
  }
  // Ask the browser for the primary family explicitly. Passing the whole stack
  // here can resolve against a fallback face and skip the actual webfont fetch.
  const descriptor = `${font.weight} ${font.sizePx}px ${resolvePrimaryTerminalFontFamily(font.family)}`;
  try {
    await fonts.load(descriptor, "MW@#");
  } catch {
    // Ignore CSS Font Loading API failures and let the renderer keep its normal fallback path.
  }
  try {
    await fonts.ready;
  } catch {
    // Ignore CSS Font Loading API failures and let the renderer keep its normal fallback path.
  }
  await waitForAnimationFrame();
};
