import { describe, expect, test } from "bun:test";

import { AgenterAI } from "../src/agenter-ai";
import { FilePromptStore } from "../src/prompt-store";
import type { DeepseekClient } from "../src/deepseek-client";
import type { LoopBusMessage } from "../src/loop-bus";
import type { PromptDocRecord } from "../src/prompt-docs";
import type { AppServerLogger } from "../src/types";

const createPromptDocs = (): PromptDocRecord => ({
  AGENTER: { syntax: "mdx", content: "" },
  AGENTER_SYSTEM: { syntax: "mdx", content: "You are agenter-ai." },
  SYSTEM_TEMPLATE: {
    syntax: "mdx",
    content: `<Slot name="AGENTER_SYSTEM" />\n\n<Slot name="AGENTER" />\n\n<Slot name="RESPONSE_CONTRACT" />`,
  },
  RESPONSE_CONTRACT: { syntax: "mdx", content: "Use tools when needed." },
});

const createLogger = (): AppServerLogger => ({
  log: () => {
    // no-op in tests
  },
});

interface DeepseekCapture {
  messages: Parameters<DeepseekClient["respondWithMeta"]>[0]["messages"] | null;
}

const createDeepseek = (
  handler: (input: Parameters<DeepseekClient["respondWithMeta"]>[0]) => ReturnType<DeepseekClient["respondWithMeta"]>,
): DeepseekClient => {
  const client = {
    getMeta() {
      return {
        provider: "deepseek(openai-compatible)" as const,
        model: "deepseek-chat",
        baseUrl: "https://api.deepseek.com/v1",
      };
    },
    async respondWithMeta(input: Parameters<DeepseekClient["respondWithMeta"]>[0]) {
      return handler(input);
    },
  };
  return client as DeepseekClient;
};

const createTerminalGateway = () => {
  const writeCalls: Array<{ terminalId: string; text: string; submit?: boolean; submitKey?: "enter" | "linefeed" }> = [];
  return {
    writeCalls,
    gateway: {
      list: () => [],
      run: async () => ({ ok: true, message: "started" }),
      kill: async () => ({ ok: true, message: "stopped" }),
      focus: async () => ({ ok: true, message: "focused", focusedTerminalId: "iflow" }),
      write: async (input: { terminalId: string; text: string; submit?: boolean; submitKey?: "enter" | "linefeed" }) => {
        writeCalls.push(input);
        return { ok: true, message: "written" };
      },
      read: async () => ({ ok: true }),
      sliceDirty: async () => ({ ok: true, changed: false }),
    },
  };
};

const createUserMessage = (text: string): LoopBusMessage => ({
  id: "m-user",
  timestamp: Date.now(),
  name: "User",
  role: "user",
  type: "text",
  source: "chat",
  text,
});

describe("AgenterAI", () => {
  test("renders terminal help mdx with <CliHelp/> before model call", async () => {
    const capture: DeepseekCapture = { messages: null };
    const terminal = createTerminalGateway();
    const deepseek = createDeepseek(async (input) => {
      capture.messages = input.messages;
      return {
        thinking: "",
        text: "我已读取终端帮助信息。",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      deepseek,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
    });

    const terminalHelpPayload = JSON.stringify({
      kind: "terminal-help",
      terminalId: "iflow",
      command: "iflow",
      source: "./.agenter/man/iflow.md",
      doc: { syntax: "mdx", content: '<CliHelp command="iflow"/>' },
      manuals: { iflow: "IFLOW HELP CONTENT" },
    });

    const response = await ai.send([
      createUserMessage("先读取 iflow 帮助，然后告诉我规则"),
      {
        id: "m-help",
        timestamp: Date.now() + 1,
        name: "Terminal-iflow",
        role: "user",
        type: "text",
        source: "terminal",
        text: terminalHelpPayload,
      },
    ]);

    expect(response).toBeDefined();
    if (!response) {
      return;
    }
    expect(response.stage).toBe("decide");
    expect(response.done).toBeFalse();
    expect(response.outputs?.toUser.some((item) => item.channel === "self_talk")).toBeTrue();

    const joinedHistory = capture.messages?.map((item) => item.content.map((part) => part.content).join("\n")).join("\n\n") ?? "";
    expect(joinedHistory).toContain("IFLOW HELP CONTENT");
    expect(joinedHistory).not.toContain("<CliHelp");
  });

  test("records tool trace and returns to_user message when chat_reply is called", async () => {
    const terminal = createTerminalGateway();
    const deepseek = createDeepseek(async (input) => {
      expect(input.tools.some((tool) => tool.name === "terminal_sliceDirty")).toBeTrue();
      const callTool = async (toolName: string, rawInput: unknown) => {
        const tool = input.tools.find((item) => item.name === toolName);
        expect(tool).toBeDefined();
        if (!tool || typeof tool.execute !== "function") {
          throw new Error(`tool not executable: ${toolName}`);
        }
        return tool.execute(rawInput, {
          toolCallId: `call-${toolName}`,
          emitCustomEvent: () => {
            // no-op
          },
        });
      };

      await callTool("terminal_write", {
        terminalId: "iflow",
        text: "date",
        submit: true,
        submitKey: "enter",
      });
      await callTool("chat_reply", {
        text: "已完成时间查询。",
        done: true,
        stage: "done",
      });

      return {
        thinking: "已执行 terminal_write 并确认输出。",
        text: "已完成时间查询。",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      deepseek,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
    });

    const response = await ai.send([createUserMessage("帮我在终端里执行 date，并告诉我结果")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(response.done).toBeTrue();
    expect(response.stage).toBe("done");
    expect(terminal.writeCalls).toHaveLength(1);
    expect(terminal.writeCalls[0]).toEqual({
      terminalId: "iflow",
      text: "date",
      submit: true,
      submitKey: "enter",
    });

    const toUser = response.outputs?.toUser ?? [];
    expect(toUser.some((item) => item.channel === "to_user" && item.content.includes("已完成时间查询"))).toBeTrue();
    expect(toUser.some((item) => item.channel === "tool_call" && item.content.includes("yaml+tool_call"))).toBeTrue();
    expect(toUser.some((item) => item.channel === "tool_result" && item.content.includes("yaml+tool_result"))).toBeTrue();
  });

  test("writes compact assistant history without markdown scaffold headers", async () => {
    const terminal = createTerminalGateway();
    let callCount = 0;
    let secondCallMessages: Parameters<DeepseekClient["respondWithMeta"]>[0]["messages"] | null = null;
    const deepseek = createDeepseek(async (input) => {
      callCount += 1;
      if (callCount === 2) {
        secondCallMessages = input.messages;
      }
      return {
        thinking: "先确认终端输出，再给用户回复。",
        text: "我正在处理中。",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      deepseek,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
    });

    await ai.send([createUserMessage("第一轮")]);
    await ai.send([createUserMessage("第二轮")]);

    const assistantHistory = secondCallMessages
      ?.filter((message) => message.role === "assistant")
      .flatMap((message) => message.content.map((part) => part.content))
      .join("\n\n") ?? "";
    expect(assistantHistory).toContain("assistant_text:");
    expect(assistantHistory).not.toContain("## Assistant Turn");
    expect(assistantHistory).not.toContain("### text");
    expect(assistantHistory).not.toContain("```text");
  });

  test("supports terminal_focus tool with focused terminal metadata", async () => {
    let focusedId = "iflow";
    const deepseek = createDeepseek(async (input) => {
      const callTool = async (toolName: string, rawInput: unknown) => {
        const tool = input.tools.find((item) => item.name === toolName);
        expect(tool).toBeDefined();
        if (!tool || typeof tool.execute !== "function") {
          throw new Error(`tool not executable: ${toolName}`);
        }
        return tool.execute(rawInput, {
          toolCallId: `call-${toolName}`,
          emitCustomEvent: () => {
            // no-op
          },
        });
      };

      const listBefore = (await callTool("terminal_list", {})) as {
        terminals: Array<{ terminalId: string; focused?: boolean }>;
      };
      expect(listBefore.terminals.find((item) => item.terminalId === "iflow")?.focused).toBeTrue();
      expect(listBefore.terminals.find((item) => item.terminalId === "codex")?.focused).toBeFalse();

      const focusResult = (await callTool("terminal_focus", {
        terminalId: "codex",
        focus: true,
      })) as { ok: boolean; focusedTerminalId?: string };
      expect(focusResult.ok).toBeTrue();
      expect(focusResult.focusedTerminalId).toBe("codex");

      await callTool("chat_reply", {
        text: "focus switched",
        done: false,
        stage: "observe",
      });

      return {
        thinking: "switch focus and continue.",
        text: "focus switched",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      deepseek,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: {
        list: () => [
          { terminalId: "iflow", running: true, cols: 80, rows: 24, focused: focusedId === "iflow", dirty: false, latestSeq: 10 },
          { terminalId: "codex", running: true, cols: 80, rows: 24, focused: focusedId === "codex", dirty: true, latestSeq: 24 },
        ],
        run: async () => ({ ok: true, message: "started" }),
        kill: async () => ({ ok: true, message: "stopped" }),
        focus: async ({ terminalId }) => {
          focusedId = terminalId;
          return { ok: true, message: "focus updated", focusedTerminalId: terminalId };
        },
        write: async () => ({ ok: true, message: "written" }),
        read: async () => ({ ok: true }),
        sliceDirty: async () => ({ ok: true, changed: false }),
      },
    });

    const response = await ai.send([createUserMessage("switch focus")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }
    expect(response.outputs?.toUser.some((item) => item.channel === "tool_call" && item.content.includes("terminal_focus"))).toBeTrue();
    expect(response.outputs?.toUser.some((item) => item.channel === "to_user" && item.content.includes("focus switched"))).toBeTrue();
  });

  test("drops internal trace markers from self-talk display message", async () => {
    const terminal = createTerminalGateway();
    const deepseek = createDeepseek(async () => ({
      thinking: "",
      text: `assistant_text: 我先继续执行。
tool_trace_count: 4
tool_trace_tools: terminal_sliceDirty, terminal_write
- tool=terminal_sliceDirty ok=true ts=2026-03-02T00:00:00Z
现在继续下一步。`,
      finishReason: "stop",
    }));

    const ai = new AgenterAI({
      deepseek,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
    });

    const response = await ai.send([createUserMessage("继续")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    const selfTalk = (response.outputs?.toUser ?? []).find((item) => item.channel === "self_talk");
    expect(selfTalk).toBeDefined();
    if (!selfTalk) {
      return;
    }
    expect(selfTalk.content).toContain("现在继续下一步。");
    expect(selfTalk.content).not.toContain("tool_trace_count");
    expect(selfTalk.content).not.toContain("- tool=");
    expect(selfTalk.content).not.toContain("assistant_text:");
  });
});
