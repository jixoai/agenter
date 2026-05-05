import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  __resetTerminalFontLoaderForTests,
  ensureTerminalFontPrepared,
  resolvePrimaryTerminalFontFamily,
  resolveTerminalFontAsset,
} from "../src/terminal-font-loader";

describe("Feature: terminal font loader law", () => {
  const documentFontsLoad = vi.fn(async () => []);

  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    __resetTerminalFontLoaderForTests();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        load: documentFontsLoad,
      },
    });
    documentFontsLoad.mockClear();
  });

  test("Scenario: Given a terminal font stack When resolving the primary family Then quoted family names survive and system fallback remains literal", () => {
    expect(resolvePrimaryTerminalFontFamily("'JetBrains Mono', Menlo, monospace")).toBe("'JetBrains Mono'");
    expect(resolvePrimaryTerminalFontFamily("ui-monospace, 'SF Mono', monospace")).toBe("ui-monospace");
  });

  test("Scenario: Given a known terminal webfont family When resolving terminal-owned assets Then terminal-view returns the matching asset definition", () => {
    expect(resolveTerminalFontAsset("'JetBrains Mono', Menlo, monospace")?.key).toBe("jetbrains-mono");
    expect(resolveTerminalFontAsset("'IBM Plex Mono', monospace")?.key).toBe("ibm-plex-mono");
    expect(resolveTerminalFontAsset("'Cascadia Mono', monospace")?.key).toBe("cascadia-mono");
    expect(resolveTerminalFontAsset("'Geist Mono', monospace")?.key).toBe("geist-mono");
    expect(resolveTerminalFontAsset("ui-monospace, monospace")?.key).toBe("system-mono");
  });

  test("Scenario: Given a terminal-owned webfont profile When preparing the font Then terminal-view injects one stylesheet and loads both normal and bold faces", async () => {
    await ensureTerminalFontPrepared({
      family: "'JetBrains Mono', Menlo, monospace",
      sizePx: 14,
      weight: "400",
      weightBold: "700",
    });

    const styles = document.head.querySelectorAll('style[data-terminal-font-asset="agenter-terminal-font-jetbrains-mono"]');
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toContain("font-family: 'JetBrains Mono';");
    expect(documentFontsLoad.mock.calls).toEqual(
      expect.arrayContaining([
        ["400 14px 'JetBrains Mono'", "MW@#"],
        ["700 14px 'JetBrains Mono'", "MW@#"],
      ]),
    );
  });

  test("Scenario: Given repeated preparation for the same terminal font signature When terminal-view prepares the font again Then stylesheet injection and font loading stay deduped", async () => {
    const font = {
      family: "'JetBrains Mono', Menlo, monospace",
      sizePx: 14,
      weight: "400",
      weightBold: "700",
    } as const;

    await ensureTerminalFontPrepared(font);
    await ensureTerminalFontPrepared(font);

    expect(document.head.querySelectorAll('style[data-terminal-font-asset="agenter-terminal-font-jetbrains-mono"]')).toHaveLength(
      1,
    );
    expect(documentFontsLoad).toHaveBeenCalledTimes(2);
  });

  test("Scenario: Given the host already declares the same font family When terminal-view prepares the matching webfont Then the loader still injects its owned stylesheet so the asset source stays explicit", async () => {
    const hostStyle = document.createElement("style");
    hostStyle.textContent = "@font-face { font-family: 'JetBrains Mono'; src: url(fake.woff2) format('woff2'); }";
    document.head.append(hostStyle);

    await ensureTerminalFontPrepared({
      family: "'JetBrains Mono', Menlo, monospace",
      sizePx: 14,
      weight: "400",
      weightBold: "700",
    });

    expect(document.head.querySelectorAll('style[data-terminal-font-asset="agenter-terminal-font-jetbrains-mono"]')).toHaveLength(
      1,
    );
    expect(documentFontsLoad.mock.calls).toEqual(
      expect.arrayContaining([
        ["400 14px 'JetBrains Mono'", "MW@#"],
        ["700 14px 'JetBrains Mono'", "MW@#"],
      ]),
    );
  });

  test("Scenario: Given the durable default system stack When terminal-view prepares the font Then no webfont stylesheet or browser load is attempted", async () => {
    await ensureTerminalFontPrepared({
      family: "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      sizePx: 14,
      weight: "400",
      weightBold: "700",
    });

    expect(document.head.querySelectorAll('style[data-terminal-font-asset]')).toHaveLength(0);
    expect(documentFontsLoad).not.toHaveBeenCalled();
  });
});
