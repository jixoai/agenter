import type { TerminalFontProfile } from "../terminal-renderer-profile";
import { resolvePrimaryTerminalFontFamily } from "../terminal-font-catalog";
import { ensureTerminalFontPrepared } from "../terminal-font-loader";

const waitForAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

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
export const waitForBrowserTerminalFont = async (
  font: Pick<TerminalFontProfile, "family" | "sizePx" | "weight" | "weightBold">,
) => {
  if (typeof document === "undefined") {
    return;
  }
  await ensureTerminalFontPrepared({
    family: font.family,
    sizePx: font.sizePx,
    weight: font.weight,
    weightBold: font.weightBold,
  });
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
