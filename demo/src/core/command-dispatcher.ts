import type { DebugLogger } from "../infra/logger";

export interface DispatchInput {
  taskId: string;
  text: string;
  submit: boolean;
  submitKey?: "enter" | "linefeed";
  submitGapMs?: number;
}

export interface TerminalCommandWriter {
  writeMixed: (input: string) => Promise<void>;
}

export const resolveSubmitSequence = (submitKey: "enter" | "linefeed" = "enter"): "enter" | "linefeed" => {
  if (submitKey === "linefeed") {
    return "linefeed";
  }
  return "enter";
};

const trimTrailingNewline = (text: string): string => text.replace(/[\r\n]+$/g, "");
const resolveSubmitGapMs = (payloadChars: number): number => {
  // Keep a small gap between payload and submit key so interactive TUIs can
  // distinguish user typing from paste frames.
  const bySize = Math.ceil(payloadChars / 6);
  return Math.max(90, Math.min(220, bySize));
};

const injectBangDelay = (payload: string): string => {
  if (!payload.startsWith("!") || payload.startsWith("!<wait")) {
    return payload;
  }
  return `!<wait ms="200"/>${payload.slice(1)}`;
};

const toMixedInput = (input: DispatchInput): { mixed: string; submitGapMs: number } => {
  const payload = injectBangDelay(trimTrailingNewline(input.text));
  const submitGapMs = input.submitGapMs ?? resolveSubmitGapMs(payload.length);
  const parts: string[] = [];
  if (payload.length > 0) {
    parts.push(payload);
  }
  if (input.submit) {
    const submitKey = resolveSubmitSequence(input.submitKey);
    parts.push(`<wait ms="${submitGapMs}"/>`);
    parts.push(`<key data="${submitKey}"/>`);
  }
  return {
    mixed: parts.join(""),
    submitGapMs,
  };
};

export class CommandDispatcher {
  constructor(
    private readonly writer: TerminalCommandWriter,
    private readonly logger: DebugLogger,
  ) {}

  async dispatch(input: DispatchInput): Promise<void> {
    const payload = trimTrailingNewline(input.text);
    const mixed = toMixedInput(input);
    this.logger.log({
      channel: "agent",
      level: "debug",
      message: "command.prepare",
      meta: { taskId: input.taskId, submit: input.submit, chars: payload.length, mixedChars: mixed.mixed.length },
    });

    if (mixed.mixed.length === 0) {
      this.logger.log({
        channel: "agent",
        level: "debug",
        message: "command.done",
        meta: { taskId: input.taskId, skipped: true },
      });
      return;
    }

    await this.writer.writeMixed(mixed.mixed);
    this.logger.log({
      channel: "agent",
      level: "debug",
      message: "command.write",
      meta: {
        taskId: input.taskId,
        chars: payload.length,
        submitGapMs: mixed.submitGapMs,
        via: "terminal.pending-input",
      },
    });
    if (input.submit) {
      this.logger.log({
        channel: "agent",
        level: "debug",
        message: "command.submit",
        meta: {
          taskId: input.taskId,
          submitKey: input.submitKey ?? "enter",
        },
      });
    }

    this.logger.log({
      channel: "agent",
      level: "debug",
      message: "command.done",
      meta: { taskId: input.taskId },
    });
  }
}
