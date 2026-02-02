import { MemoryManager } from "./memory-manager";
import { Rememberer } from "./rememberer";
import { callAIStream } from "./call-ai";
import { createFact } from "./utils";
import { CognitiveState, Message } from "./types";
import { loadRuntimeConfig } from "./config";

interface RecallRequest {
  id: number;
  type: "recall";
  tab_id: number;
  message: string;
}

interface RespondRequest {
  id: number;
  type: "respond";
  tab_id: number;
  message: string;
}

interface ResetRequest {
  id: number;
  type: "reset";
}

type BridgeRequest = RecallRequest | RespondRequest | ResetRequest;

const send = (payload: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
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

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
};

const parseResponderPayload = (raw: string): { reply: string; summary: string; tools: string[] } => {
  const summaryMatch = raw.match(/SUMMARY:\s*(.*)/i);
  const toolsMatch = raw.match(/TOOLS:\s*(.*)/i);
  const answerIndex = raw.toLowerCase().indexOf("answer:");
  const reply = answerIndex === -1 ? raw.trim() : raw.slice(answerIndex + "answer:".length).trim();

  const toolsRaw = toolsMatch?.[1]?.trim() ?? "NONE";
  const toolCalls = toolsRaw === "NONE" || !toolsRaw ? [] : toolsRaw.split(/\s*,\s*/);

  return {
    reply,
    summary: summaryMatch?.[1]?.trim() ?? "(summary unavailable)",
    tools: toolCalls,
  };
};

const run = async (): Promise<void> => {
  const { model, storageDir } = await loadRuntimeConfig();
  const memory = new MemoryManager(storageDir);
  const rememberer = new Rememberer(memory, model);

  const cognitiveStateByTab = new Map<number, CognitiveState>();

  let buffer = "";
  let queue = Promise.resolve();

  const handleRequest = async (request: BridgeRequest): Promise<void> => {
    if (request.type === "reset") {
      await memory.reset();
      send({ id: request.id, type: "reset_done" });
      return;
    }

    if (request.type === "recall") {
      await memory.appendFact(createFact("USER_MSG", request.message));
      const recall = await rememberer.recallWithTrace(request.message);
      cognitiveStateByTab.set(request.tab_id, recall.cognitiveState);

      const memoryText = [
        `tool: ${recall.trace.tool_calls.join(" | ")}`,
        `current_goal: ${recall.cognitiveState.current_goal}`,
        `plan_status: ${JSON.stringify(recall.cognitiveState.plan_status)}`,
        `key_facts: ${JSON.stringify(recall.cognitiveState.key_facts)}`,
        `last_action_result: ${recall.cognitiveState.last_action_result}`,
      ].join("\n");

      send({
        id: request.id,
        type: "recall_result",
        tab_id: request.tab_id,
        memory_text: memoryText,
      });
      return;
    }

    if (request.type === "respond") {
      const state = cognitiveStateByTab.get(request.tab_id);
      if (!state) {
        send({ id: request.id, type: "respond_error", message: "Missing cognitive state" });
        return;
      }

      const messages = buildChatMessages(state, request.message);

      let summary = "(summary unavailable)";
      let tools: string[] = [];
      let answerStarted = false;
      let bufferText = "";
      let answer = "";
      let metaSent = false;

      const sendMeta = () => {
        if (metaSent) return;
        metaSent = true;
        send({
          id: request.id,
          type: "respond_meta",
          tab_id: request.tab_id,
          summary,
          tools,
        });
      };

      const onToken = (token: string) => {
        if (!answerStarted) {
          bufferText += token;
          while (true) {
            const newlineIndex = bufferText.indexOf("\n");
            if (newlineIndex === -1) break;
            const line = bufferText.slice(0, newlineIndex).trim();
            bufferText = bufferText.slice(newlineIndex + 1);

            if (line.toUpperCase().startsWith("SUMMARY:")) {
              summary = line.slice("SUMMARY:".length).trim() || summary;
              continue;
            }
            if (line.toUpperCase().startsWith("TOOLS:")) {
              const toolsRaw = line.slice("TOOLS:".length).trim();
              tools = toolsRaw && toolsRaw !== "NONE" ? toolsRaw.split(/\s*,\s*/) : [];
              continue;
            }
            if (line.toUpperCase().startsWith("ANSWER:")) {
              answerStarted = true;
              sendMeta();
              const rest = line.slice("ANSWER:".length).trim();
              if (rest) {
                answer += rest + "\n";
                send({ id: request.id, type: "respond_delta", tab_id: request.tab_id, delta: rest + "\n" });
              }
              break;
            }
          }
          if (answerStarted && bufferText.length > 0) {
            answer += bufferText;
            send({ id: request.id, type: "respond_delta", tab_id: request.tab_id, delta: bufferText });
            bufferText = "";
          }
          return;
        }

        answer += token;
        send({ id: request.id, type: "respond_delta", tab_id: request.tab_id, delta: token });
      };

      const full = await callAIStream(messages, model, onToken, sendMeta);
      const parsed = parseResponderPayload(full);
      summary = parsed.summary;
      tools = parsed.tools;
      answer = parsed.reply;
      sendMeta();

      await memory.appendFact(createFact("AI_THOUGHT", parsed.reply, { kind: "chat_reply" }));

      send({
        id: request.id,
        type: "respond_done",
        tab_id: request.tab_id,
        reply: parsed.reply,
        summary,
        tools,
      });
    }
  };

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let index: number;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;

      try {
        const request = JSON.parse(line) as BridgeRequest;
        queue = queue.then(() => handleRequest(request)).catch((error) => {
          send({ id: request.id, type: "error", message: String(error) });
        });
      } catch (error) {
        send({ id: -1, type: "error", message: String(error) });
      }
    }
  });
};

run().catch((error) => {
  send({ id: -1, type: "error", message: String(error) });
});
