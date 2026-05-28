import { RGBA, StyledText, TextAttributes, type MouseEvent, type TextChunk } from "@opentui/core";

export type ShellNextButtonId = string;

export interface ShellNextButtonState {
  readonly id: ShellNextButtonId;
  readonly label: string;
  readonly active?: boolean;
  readonly hovered?: boolean;
  readonly disabled?: boolean;
}

export interface ShellNextButtonRegion {
  readonly id: ShellNextButtonId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height?: number;
}

export interface ShellNextButtonTextInput {
  readonly button: ShellNextButtonState;
  readonly fg: RGBA;
}

export type ShellNextButtonTextPart = string | ShellNextButtonTextInput;

interface NormalizedShellNextButtonSegments {
  readonly left: string;
  readonly content: string;
  readonly right: string;
}

export const normalizeShellNextButtonLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }
  return `[${trimmed}]`;
};

export const shellNextButtonWidth = (label: string): number => Bun.stringWidth(normalizeShellNextButtonLabel(label));

export const splitShellNextButtonLabel = (label: string): NormalizedShellNextButtonSegments => {
  const normalized = normalizeShellNextButtonLabel(label);
  if (normalized.length < 2) {
    return {
      left: "",
      content: normalized,
      right: "",
    };
  }
  return {
    left: normalized[0] ?? "",
    content: normalized.slice(1, -1),
    right: normalized.at(-1) ?? "",
  };
};

export const resolveShellNextButtonAttributes = (button: {
  readonly active?: boolean;
  readonly hovered?: boolean;
  readonly disabled?: boolean;
}): number =>
  (button.active ? TextAttributes.UNDERLINE : TextAttributes.NONE) |
  (button.hovered ? TextAttributes.BOLD : TextAttributes.NONE) |
  (button.disabled ? TextAttributes.DIM : TextAttributes.NONE);

export const buildShellNextButtonChunk = (input: ShellNextButtonTextInput): TextChunk => ({
  __isChunk: true,
  text: normalizeShellNextButtonLabel(input.button.label),
  fg: input.fg,
  attributes: resolveShellNextButtonAttributes(input.button),
});

export const buildShellNextButtonChunks = (input: ShellNextButtonTextInput): TextChunk[] => {
  const segments = splitShellNextButtonLabel(input.button.label);
  const attributes = resolveShellNextButtonAttributes(input.button);
  return [
    buildShellNextPlainChunk(segments.left, input.fg),
    {
      __isChunk: true,
      text: segments.content,
      fg: input.fg,
      attributes,
    },
    buildShellNextPlainChunk(segments.right, input.fg),
  ];
};

export const buildShellNextPlainChunk = (text: string, fg: RGBA): TextChunk => ({
  __isChunk: true,
  text,
  fg,
  attributes: TextAttributes.NONE,
});

export const buildShellNextButtonStyledText = (
  parts: readonly ShellNextButtonTextPart[],
  fallbackFg: RGBA,
): StyledText =>
  new StyledText(
    parts.flatMap((part) => (typeof part === "string" ? [buildShellNextPlainChunk(part, fallbackFg)] : buildShellNextButtonChunks(part))),
  );

export const resolveShellNextButtonAt = (
  event: MouseEvent,
  regions: readonly ShellNextButtonRegion[],
): ShellNextButtonId | null => {
  const x = Math.trunc(event.x);
  const y = Math.trunc(event.y);
  const region = regions.find((candidate) => {
    const height = candidate.height ?? 1;
    return y >= candidate.y && y < candidate.y + height && x >= candidate.x && x < candidate.x + candidate.width;
  });
  return region?.id ?? null;
};
