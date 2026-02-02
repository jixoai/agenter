import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { MemoryManager } from "./memory-manager";
import { Rememberer } from "./rememberer";
import { callAIStream } from "./call-ai";
import { createFact } from "./utils";
import { CognitiveState, Message } from "./types";
import { loadRuntimeConfig } from "./config";

interface RespondPayload {
  reply: string;
  reasoning_summary: string;
  tool_calls: string[];
}

interface SectionLine {
  text: string;
  tone?: "dim" | "normal";
}

interface AnswerStreamState {
  summary: string;
  toolsLine: string;
  answerStarted: boolean;
  buffered: string;
}

const S = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  underline: "\u001b[4m",
  inverse: "\u001b[7m",
  fgWhite: "\u001b[97m",
  fgBlack: "\u001b[30m",
  bgBlue: "\u001b[44m",
  bgMagenta: "\u001b[45m",
  bgGreen: "\u001b[42m",
};

const buildChatMessages = (state: CognitiveState, userMessage: string): Message[] => {
  const systemPrompt = [
    "You are Agenter, a helpful assistant.",
    "TASK: RESPOND_USER",
    "Use only COGNITIVE_STATE_JSON to answer the user.",
    "Return in the exact format:",
    "SUMMARY: <one sentence>",
    "TOOLS: <comma-separated or NONE>",
    "ANSWER:",
    "<answer in markdown>",
    "Do NOT reveal chain-of-thought.",
    `COGNITIVE_STATE_JSON=${JSON.stringify(state)}`,
  ].join("\n");

  // IMPORTANT: This is a brand-new context. No prior chat history is appended.
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
};

const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, "");

const isFullWidthCodePoint = (codePoint: number): boolean => {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
      (codePoint >= 0x1f900 && codePoint <= 0x1f9ff))
  );
};

const isCombiningCodePoint = (codePoint: number): boolean => {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  );
};

const stringWidth = (text: string): number => {
  let width = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint === 0) continue;
    if (isCombiningCodePoint(codePoint)) continue;
    width += isFullWidthCodePoint(codePoint) ? 2 : 1;
  }
  return width;
};

const visibleLength = (text: string): number => stringWidth(stripAnsi(text));

const getTerminalWidth = (): number => {
  const width = output.columns ?? 80;
  return Math.max(40, width);
};

const padLine = (line: string, width: number, base: string): string => {
  const length = visibleLength(line);
  if (length >= width) return line;
  return line + base + " ".repeat(width - length);
};

const wrapText = (text: string, width: number): string[] => {
  if (width <= 0) return [text];
  const lines: string[] = [];
  let buffer = "";
  let bufferWidth = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const charWidth = isCombiningCodePoint(codePoint) ? 0 : isFullWidthCodePoint(codePoint) ? 2 : 1;

    if (bufferWidth + charWidth > width && bufferWidth > 0) {
      lines.push(buffer);
      buffer = char;
      bufferWidth = charWidth;
      continue;
    }

    buffer += char;
    bufferWidth += charWidth;
  }

  lines.push(buffer);
  return lines;
};

const formatMarkdownLine = (line: string, resetToBase: string): string => {
  if (line.startsWith("### ")) {
    return `${S.bold}${line.slice(4)}${resetToBase}`;
  }
  if (line.startsWith("## ")) {
    return `${S.bold}${line.slice(3)}${resetToBase}`;
  }
  if (line.startsWith("# ")) {
    return `${S.bold}${S.underline}${line.slice(2)}${resetToBase}`;
  }
  if (line.startsWith("- ") || line.startsWith("* ")) {
    return `${S.bold}-${resetToBase} ${line.slice(2)}`;
  }

  let out = line;
  out = out.replace(/`([^`]+)`/g, `${S.inverse}$1${resetToBase}`);
  out = out.replace(/\*\*([^*]+)\*\*/g, `${S.bold}$1${resetToBase}`);
  out = out.replace(/__([^_]+)__/g, `${S.underline}$1${resetToBase}`);
  return out;
};

const printHeaderLine = (title: string, styles: { bg: string; fg: string }): void => {
  const width = getTerminalWidth();
  const base = `${styles.bg}${styles.fg}`;
  const resetToBase = `${S.reset}${base}`;
  const line = `${base}${S.bold} ${title} ${resetToBase}`;
  output.write(padLine(line, width, base) + S.reset + "\n");
};

const printSectionLines = (lines: SectionLine[], styles: { bg: string; fg: string }): void => {
  const width = getTerminalWidth();
  const base = `${styles.bg}${styles.fg}`;
  const resetToBase = `${S.reset}${base}`;
  const contentWidth = width - 2;

  for (const line of lines) {
    const wrapped = wrapText(line.text, contentWidth);
    for (const segment of wrapped) {
      const tone = line.tone === "dim" ? S.dim : "";
      const content = line.tone === "dim" ? segment : formatMarkdownLine(segment, resetToBase);
      const raw = `${base} ${tone}${content}${resetToBase}`;
      output.write(padLine(raw, width, base) + S.reset + "\n");
    }
  }
};

const renderInputArea = (buffer: string): number => {
  const width = getTerminalWidth();
  const base = `${S.bgBlue}${S.fgWhite}`;
  const prefix = " > ";
  const contentWidth = Math.max(1, width - prefix.length);
  const lines = buffer.length === 0 ? [""] : buffer.split("\n");
  let printed = 0;

  for (const line of lines) {
    const segments = wrapText(line, contentWidth);
    for (const segment of segments) {
      const raw = `${base}${prefix}${segment}`;
      output.write(padLine(raw, width, base) + S.reset + "\n");
      printed += 1;
    }
  }
  return printed;
};

const promptInput = async (): Promise<string> => {
  readline.emitKeypressEvents(input);
  if (input.isTTY) {
    input.setRawMode(true);
  }

  let buffer = "";
  let renderedLines = 0;

  const clearRendered = () => {
    if (renderedLines <= 0) return;
    readline.moveCursor(output, 0, -renderedLines);
    readline.cursorTo(output, 0);
    for (let i = 0; i < renderedLines; i += 1) {
      readline.clearLine(output, 0);
      if (i < renderedLines - 1) {
        readline.moveCursor(output, 0, 1);
      }
    }
    readline.moveCursor(output, 0, -Math.max(0, renderedLines - 1));
    readline.cursorTo(output, 0);
  };

  const render = () => {
    clearRendered();
    renderedLines = renderInputArea(buffer);
  };

  output.write("\n");
  render();

  return await new Promise<string>((resolve) => {
    const onKeypress = (str: string, key: readline.Key) => {
      if (key.ctrl && key.name === "c") {
        output.write(S.reset + "\n");
        process.exit(0);
      }

      const isShiftEnter =
        (key.name === "return" && (key.shift || key.meta || key.ctrl)) ||
        str === "\u001b[13;2u" ||
        str === "\u001b[13;5u";
      const isEnter =
        key.name === "return" ||
        key.name === "enter" ||
        str === "\r" ||
        str === "\n";

      if (isShiftEnter) {
        buffer += "\n";
        render();
        return;
      }

      if (isEnter) {
        clearRendered();
        renderedLines = 0;
        input.off("keypress", onKeypress);
        resolve(buffer);
        return;
      }

      if (key.name === "backspace") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          render();
        }
        return;
      }

      if (key.name === "escape") {
        return;
      }

      if (str) {
        buffer += str;
        render();
      }
    };

    input.on("keypress", onKeypress);
  });
};

class BlockWriter {
  private readonly styles: { bg: string; fg: string };
  private buffer = "";

  constructor(styles: { bg: string; fg: string }) {
    this.styles = styles;
  }

  write(chunk: string): void {
    this.buffer += chunk;
    this.flush(false);
  }

  end(): void {
    this.flush(true);
  }

  private flush(force: boolean): void {
    const width = getTerminalWidth();
    const base = `${this.styles.bg}${this.styles.fg}`;
    const resetToBase = `${S.reset}${base}`;
    const contentWidth = width - 2;

    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex !== -1) {
        const line = this.buffer.slice(0, newlineIndex);
        this.printLine(line, base, resetToBase, width, contentWidth);
        this.buffer = this.buffer.slice(newlineIndex + 1);
        continue;
      }
      if (this.buffer.length >= contentWidth || (force && this.buffer.length > 0)) {
        const line = force ? this.buffer : this.buffer.slice(0, contentWidth);
        this.printLine(line, base, resetToBase, width, contentWidth);
        this.buffer = force ? "" : this.buffer.slice(contentWidth);
        continue;
      }
      break;
    }
  }

  private printLine(
    line: string,
    base: string,
    resetToBase: string,
    width: number,
    contentWidth: number
  ): void {
    const wrappedSegments = wrapText(line, contentWidth);
    for (const segment of wrappedSegments) {
      const content = formatMarkdownLine(segment, resetToBase);
      const raw = `${base} ${content}${resetToBase}`;
      output.write(padLine(raw, width, base) + S.reset + "\n");
    }
  }
}

const parseResponderPayload = (raw: string): RespondPayload => {
  const summaryMatch = raw.match(/SUMMARY:\s*(.*)/i);
  const toolsMatch = raw.match(/TOOLS:\s*(.*)/i);
  const answerIndex = raw.toLowerCase().indexOf("answer:");
  const reply = answerIndex === -1 ? raw.trim() : raw.slice(answerIndex + "answer:".length).trim();

  const toolsRaw = toolsMatch?.[1]?.trim() ?? "NONE";
  const toolCalls = toolsRaw === "NONE" || !toolsRaw ? [] : toolsRaw.split(/\s*,\s*/);

  return {
    reply,
    reasoning_summary: summaryMatch?.[1]?.trim() ?? "(summary unavailable)",
    tool_calls: toolCalls,
  };
};

const printHelp = (): void => {
  console.log("\nAgenter Terminal Chat");
  console.log("Commands:");
  console.log("  /exit   Quit");
  console.log("  /reset  Clear memory");
  console.log("");
};

export const runTerminalApp = async (): Promise<void> => {
  const { model, storageDir } = await loadRuntimeConfig();
  const memory = new MemoryManager(storageDir);
  const rememberer = new Rememberer(memory, model);

  printHelp();

  while (true) {
    const rawInput = await promptInput();
    const message = rawInput.trim();
    if (!message) continue;
    if (message === "/exit") break;
    if (message === "/reset") {
      await memory.reset();
      console.log("Memory cleared.");
      continue;
    }

    await memory.appendFact(createFact("USER_MSG", message));

    const recallResult = await rememberer.recallWithTrace(message);
    const cognitiveState = recallResult.cognitiveState;

    output.write("\n");
    printHeaderLine("USER", { bg: S.bgBlue, fg: S.fgWhite });
    const userLines = message.split("\n").map((line) => ({ text: line }));
    printSectionLines(userLines, { bg: S.bgBlue, fg: S.fgWhite });

    printHeaderLine("MEMORY", { bg: S.bgMagenta, fg: S.fgWhite });
    const recallLines: SectionLine[] = [
      { text: `tool: ${recallResult.trace.tool_calls.join(" | ")}`, tone: "dim" },
      { text: `current_goal: ${cognitiveState.current_goal}` },
      { text: `plan_status: ${JSON.stringify(cognitiveState.plan_status)}` },
      { text: `key_facts: ${JSON.stringify(cognitiveState.key_facts)}` },
      { text: `last_action_result: ${cognitiveState.last_action_result}` },
    ];
    printSectionLines(recallLines, { bg: S.bgMagenta, fg: S.fgWhite });

    const streamState: AnswerStreamState = {
      summary: "(summary unavailable)",
      toolsLine: "NONE",
      answerStarted: false,
      buffered: "",
    };

    let writer: BlockWriter | null = null;

    const handleToken = (token: string) => {
      streamState.buffered += token;

      if (!streamState.answerStarted) {
        while (true) {
          const newlineIndex = streamState.buffered.indexOf("\n");
          if (newlineIndex === -1) break;
          const line = streamState.buffered.slice(0, newlineIndex).trim();
          streamState.buffered = streamState.buffered.slice(newlineIndex + 1);

          if (line.toUpperCase().startsWith("SUMMARY:")) {
            streamState.summary = line.slice("SUMMARY:".length).trim() || streamState.summary;
          } else if (line.toUpperCase().startsWith("TOOLS:")) {
            streamState.toolsLine = line.slice("TOOLS:".length).trim() || streamState.toolsLine;
          } else if (line.toUpperCase().startsWith("ANSWER:")) {
            streamState.answerStarted = true;
            printHeaderLine("ANSWER", { bg: S.bgGreen, fg: S.fgBlack });
            const toolCallsText = streamState.toolsLine || "NONE";
            const toolCalls = toolCallsText === "NONE" ? "(none)" : toolCallsText;
            const answerMeta: SectionLine[] = [
              { text: `thinking: ${streamState.summary}`, tone: "dim" },
              { text: `tool_calls: ${toolCalls}`, tone: "dim" },
            ];
            printSectionLines(answerMeta, { bg: S.bgGreen, fg: S.fgBlack });
            writer = new BlockWriter({ bg: S.bgGreen, fg: S.fgBlack });

            const rest = line.slice("ANSWER:".length).trim();
            if (rest && writer) {
              writer.write(rest + "\n");
            }
            break;
          }
        }
      }

      if (streamState.answerStarted && writer) {
        writer.write(streamState.buffered);
        streamState.buffered = "";
      }
    };

    const chatMessages = buildChatMessages(cognitiveState, message);
    let fullResponse = "";
    try {
      fullResponse = await callAIStream(chatMessages, model, handleToken);
    } catch (error) {
      output.write(S.reset + "\n");
      throw error;
    }

    if (!streamState.answerStarted) {
      const parsed = parseResponderPayload(fullResponse);
      printHeaderLine("ANSWER", { bg: S.bgGreen, fg: S.fgBlack });
      const toolCallsText = parsed.tool_calls.length ? parsed.tool_calls.join(", ") : "(none)";
      const answerMeta: SectionLine[] = [
        { text: `thinking: ${parsed.reasoning_summary}`, tone: "dim" },
        { text: `tool_calls: ${toolCallsText}`, tone: "dim" },
      ];
      printSectionLines(answerMeta, { bg: S.bgGreen, fg: S.fgBlack });
      writer = new BlockWriter({ bg: S.bgGreen, fg: S.fgBlack });
      writer.write(parsed.reply);
    }

    writer?.end();

    const parsedForMemory = parseResponderPayload(fullResponse);
    await memory.appendFact(createFact("AI_THOUGHT", parsedForMemory.reply, { kind: "chat_reply" }));
  }

  if (input.isTTY) {
    input.setRawMode(false);
  }
};

if (import.meta.main) {
  runTerminalApp().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
