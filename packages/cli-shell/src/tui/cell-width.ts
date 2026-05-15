export const measureTerminalText = (text: string): number => Bun.stringWidth(text);

const toTerminalChars = (text: string): string[] => Array.from(text);

export const fitTerminalText = (
  text: string,
  width: number,
  input: { ellipsis?: boolean } = {},
): string => {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) {
    return "";
  }
  if (measureTerminalText(text) <= safeWidth) {
    return `${text}${" ".repeat(safeWidth - measureTerminalText(text))}`;
  }

  const useEllipsis = input.ellipsis ?? false;
  if (!useEllipsis) {
    let clipped = "";
    let used = 0;
    for (const char of toTerminalChars(text)) {
      const next = measureTerminalText(char);
      if (used + next > safeWidth) {
        break;
      }
      clipped += char;
      used += next;
    }
    return `${clipped}${" ".repeat(Math.max(0, safeWidth - used))}`;
  }

  if (safeWidth === 1) {
    return "…";
  }

  const ellipsisWidth = measureTerminalText("…");
  let clipped = "";
  let used = 0;
  for (const char of toTerminalChars(text)) {
    const next = measureTerminalText(char);
    if (used + next + ellipsisWidth > safeWidth) {
      break;
    }
    clipped += char;
    used += next;
  }
  const resolved = `${clipped}…`;
  return `${resolved}${" ".repeat(Math.max(0, safeWidth - measureTerminalText(resolved)))}`;
};
