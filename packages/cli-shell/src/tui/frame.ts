import { fitTerminalText, measureTerminalText } from "./cell-width";
import type { CliShellCollapsedModel } from "./model";

export interface CliShellCollapsedFrame {
  bodyLines: string[];
  toolbarLine: string;
}

const buildToolbarLine = (model: CliShellCollapsedModel, width: number): string => {
  if (width <= 0) {
    return "";
  }

  const leftVariants = [model.toolbarLeft, model.toolbarLeft.split(" ")[0] ?? model.toolbarLeft];
  const managedVariants = [model.toolbarManaged, model.toolbarManaged.replace("托管 ", "")];
  const unreadVariants = [model.toolbarUnread, model.toolbarUnread.replace(" ⌘J", ""), "✉"];
  const separator = " │ ";

  for (const left of leftVariants) {
    for (const managed of managedVariants) {
      for (const unread of unreadVariants) {
        const reserved =
          measureTerminalText(left) +
          measureTerminalText(managed) +
          measureTerminalText(unread) +
          measureTerminalText(separator) * 3;
        if (reserved >= width) {
          continue;
        }
        const heartbeatWidth = width - reserved;
        const heartbeat = fitTerminalText(model.toolbarHeartbeat, heartbeatWidth, { ellipsis: true });
        return `${left}${separator}${heartbeat}${separator}${managed}${separator}${unread}`;
      }
    }
  }

  return fitTerminalText(model.toolbarHeartbeat, width, { ellipsis: true });
};

export const layoutCliShellCollapsedFrame = (input: {
  model: CliShellCollapsedModel;
  width: number;
  height: number;
}): CliShellCollapsedFrame => {
  const bodyHeight = Math.max(1, input.height - 1);
  const clippedBody = input.model.bodyLines.slice(-bodyHeight).map((line) => fitTerminalText(line, input.width));
  const bodyLines = clippedBody.length >= bodyHeight ? clippedBody : [...clippedBody, ...Array.from({ length: bodyHeight - clippedBody.length }, () => " ".repeat(input.width))];
  return {
    bodyLines,
    toolbarLine: fitTerminalText(buildToolbarLine(input.model, input.width), input.width),
  };
};
