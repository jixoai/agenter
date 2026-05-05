export type TerminalRendererPreference = "auto" | "ghostty-web" | "wterm" | "xterm";
export type TerminalResolvedRenderer = "ghostty-web" | "wterm" | "xterm";
export type TerminalThemeName = "default-dark" | "default-light" | "monokai";
export type TerminalCursorStyle = "block" | "bar" | "underline";

export interface TerminalFontProfile {
  family: string;
  sizePx: number;
  lineHeight: number;
  letterSpacing: number;
  weight: string;
  weightBold: string;
  ligatures: boolean;
}

export const DEFAULT_TERMINAL_RENDERER_PREFERENCE = "auto" as const satisfies TerminalRendererPreference;
export const DEFAULT_TERMINAL_THEME = "default-dark" as const satisfies TerminalThemeName;
export const DEFAULT_TERMINAL_CURSOR = "block" as const satisfies TerminalCursorStyle;
// Keep the durable default compact and renderer-neutral. The default path should
// use a system monospace stack so first paint does not depend on a webfont fetch,
// while optional webfonts can still settle through renderer-owned font loading.
export const DEFAULT_TERMINAL_FONT: Readonly<TerminalFontProfile> = {
  family: "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  sizePx: 14,
  lineHeight: 1,
  letterSpacing: 0,
  weight: "400",
  weightBold: "700",
  ligatures: true,
} as const satisfies TerminalFontProfile;

export interface TerminalThemeTokens {
  name: TerminalThemeName;
  foreground: string;
  background: string;
  cursor: string;
  cursorAccent?: string;
  selectionBackground?: string;
  selectionForeground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface ResolvedTerminalAppearance {
  themeName: TerminalThemeName;
  cursorStyle: TerminalCursorStyle;
  theme: TerminalThemeTokens;
  font: TerminalFontProfile;
}

export interface TerminalRendererResolution {
  preference: TerminalRendererPreference;
  resolvedRenderer: TerminalResolvedRenderer;
  reason: string;
}

const TERMINAL_THEME_TOKENS = {
  "default-dark": {
    name: "default-dark",
    foreground: "#e2e8f0",
    background: "#020617",
    cursor: "#38bdf8",
    cursorAccent: "#020617",
    selectionBackground: "rgba(56, 189, 248, 0.28)",
    selectionForeground: "#f8fafc",
    black: "#0f172a",
    red: "#f87171",
    green: "#4ade80",
    yellow: "#facc15",
    blue: "#60a5fa",
    magenta: "#c084fc",
    cyan: "#22d3ee",
    white: "#cbd5e1",
    brightBlack: "#475569",
    brightRed: "#fca5a5",
    brightGreen: "#86efac",
    brightYellow: "#fde047",
    brightBlue: "#93c5fd",
    brightMagenta: "#d8b4fe",
    brightCyan: "#67e8f9",
    brightWhite: "#f8fafc",
  },
  "default-light": {
    name: "default-light",
    foreground: "#0f172a",
    background: "#f8fafc",
    cursor: "#2563eb",
    cursorAccent: "#f8fafc",
    selectionBackground: "rgba(37, 99, 235, 0.2)",
    selectionForeground: "#020617",
    black: "#0f172a",
    red: "#dc2626",
    green: "#15803d",
    yellow: "#ca8a04",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#e2e8f0",
    brightBlack: "#334155",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#eab308",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#ffffff",
  },
  monokai: {
    name: "monokai",
    foreground: "#f8f8f2",
    background: "#272822",
    cursor: "#f8f8f2",
    cursorAccent: "#272822",
    selectionBackground: "rgba(117, 113, 94, 0.45)",
    selectionForeground: "#f8f8f2",
    black: "#272822",
    red: "#f92672",
    green: "#a6e22e",
    yellow: "#f4bf75",
    blue: "#66d9ef",
    magenta: "#ae81ff",
    cyan: "#a1efe4",
    white: "#f8f8f2",
    brightBlack: "#75715e",
    brightRed: "#f92672",
    brightGreen: "#a6e22e",
    brightYellow: "#f4bf75",
    brightBlue: "#66d9ef",
    brightMagenta: "#ae81ff",
    brightCyan: "#a1efe4",
    brightWhite: "#f9f8f5",
  },
} as const satisfies Record<TerminalThemeName, TerminalThemeTokens>;

export const resolveTerminalTheme = (themeName: TerminalThemeName | null | undefined): TerminalThemeTokens =>
  TERMINAL_THEME_TOKENS[themeName ?? DEFAULT_TERMINAL_THEME];

// Font is durable terminal-system truth. Renderers resolve from this shared profile
// instead of persisting engine-local font defaults or host-local CSS guesses.
export const resolveTerminalFont = (font: Partial<TerminalFontProfile> | null | undefined): TerminalFontProfile => ({
  family: font?.family ?? DEFAULT_TERMINAL_FONT.family,
  sizePx: font?.sizePx ?? DEFAULT_TERMINAL_FONT.sizePx,
  lineHeight: font?.lineHeight ?? DEFAULT_TERMINAL_FONT.lineHeight,
  letterSpacing: font?.letterSpacing ?? DEFAULT_TERMINAL_FONT.letterSpacing,
  weight: font?.weight ?? DEFAULT_TERMINAL_FONT.weight,
  weightBold: font?.weightBold ?? DEFAULT_TERMINAL_FONT.weightBold,
  ligatures: font?.ligatures ?? DEFAULT_TERMINAL_FONT.ligatures,
});

// Theme and cursor stay declarative at the durable top level. Adapters are allowed
// to map or tolerate renderer-specific capability gaps without changing profile truth.
export const resolveTerminalAppearance = (input?: {
  theme?: TerminalThemeName | null;
  cursor?: TerminalCursorStyle | null;
  font?: Partial<TerminalFontProfile> | null;
}): ResolvedTerminalAppearance => ({
  themeName: input?.theme ?? DEFAULT_TERMINAL_THEME,
  cursorStyle: input?.cursor ?? DEFAULT_TERMINAL_CURSOR,
  theme: resolveTerminalTheme(input?.theme ?? DEFAULT_TERMINAL_THEME),
  font: resolveTerminalFont(input?.font),
});

// `auto` exists because renderer choice is front-end environment policy. The
// current desktop default is `ghostty-web` because fit/cover host scaling keeps
// selection aligned more reliably there than in today's xterm-based DOM stack.
export const resolveTerminalRenderer = (
  preference: TerminalRendererPreference | null | undefined,
): TerminalRendererResolution => {
  const normalized = preference ?? DEFAULT_TERMINAL_RENDERER_PREFERENCE;
  if (normalized === "auto") {
    return {
      preference: normalized,
      resolvedRenderer: "ghostty-web",
      reason: "desktop-auto-prefers-ghostty-web-for-scale-safe-selection",
    };
  }
  return {
    preference: normalized,
    resolvedRenderer: normalized,
    reason: `explicit-${normalized}`,
  };
};
