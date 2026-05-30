import { RGBA, StyledText, TextAttributes, type MouseEvent, type TextChunk } from "@opentui/core";

export type ShellButtonId = string;

export interface ShellButtonState {
  readonly id: ShellButtonId;
  readonly label: string;
  readonly active?: boolean;
  readonly hovered?: boolean;
  readonly disabled?: boolean;
}

export interface ShellButtonRegion {
  readonly id: ShellButtonId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height?: number;
}

export interface ShellButtonTextInput {
  readonly button: ShellButtonState;
  readonly fg: RGBA;
}

export type ShellButtonTextPart = string | ShellButtonTextInput;

interface NormalizedShellButtonSegments {
  readonly left: string;
  readonly content: string;
  readonly right: string;
}

export const normalizeShellButtonLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }
  return `[${trimmed}]`;
};

export const shellButtonWidth = (label: string): number => Bun.stringWidth(normalizeShellButtonLabel(label));

export const splitShellButtonLabel = (label: string): NormalizedShellButtonSegments => {
  const normalized = normalizeShellButtonLabel(label);
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

export const resolveShellButtonAttributes = (button: {
  readonly active?: boolean;
  readonly hovered?: boolean;
  readonly disabled?: boolean;
}): number =>
  (button.active ? TextAttributes.UNDERLINE : TextAttributes.NONE) |
  (button.hovered ? TextAttributes.BOLD : TextAttributes.NONE) |
  (button.disabled ? TextAttributes.DIM : TextAttributes.NONE);

export const buildShellButtonChunk = (input: ShellButtonTextInput): TextChunk => ({
  __isChunk: true,
  text: normalizeShellButtonLabel(input.button.label),
  fg: input.fg,
  attributes: resolveShellButtonAttributes(input.button),
});

export const buildShellButtonChunks = (input: ShellButtonTextInput): TextChunk[] => {
  const segments = splitShellButtonLabel(input.button.label);
  const attributes = resolveShellButtonAttributes(input.button);
  return [
    buildShellPlainChunk(segments.left, input.fg),
    {
      __isChunk: true,
      text: segments.content,
      fg: input.fg,
      attributes,
    },
    buildShellPlainChunk(segments.right, input.fg),
  ];
};

export const buildShellPlainChunk = (text: string, fg: RGBA): TextChunk => ({
  __isChunk: true,
  text,
  fg,
  attributes: TextAttributes.NONE,
});

export const buildShellButtonStyledText = (
  parts: readonly ShellButtonTextPart[],
  fallbackFg: RGBA,
): StyledText =>
  new StyledText(
    parts.flatMap((part) => (typeof part === "string" ? [buildShellPlainChunk(part, fallbackFg)] : buildShellButtonChunks(part))),
  );

export const resolveShellButtonAt = (
  event: MouseEvent,
  regions: readonly ShellButtonRegion[],
): ShellButtonId | null => {
  const x = Math.trunc(event.x);
  const y = Math.trunc(event.y);
  const region = regions.find((candidate) => {
    const height = candidate.height ?? 1;
    return y >= candidate.y && y < candidate.y + height && x >= candidate.x && x < candidate.x + candidate.width;
  });
  return region?.id ?? null;
};
