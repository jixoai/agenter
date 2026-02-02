import path from "path";
import { promises as fs } from "fs";
import { MemoryManager } from "./memory-manager";
import { Rememberer } from "./rememberer";
import { callAI, parseExecutorDecision } from "./call-ai";
import { CognitiveState, ExecutorDecision, Message } from "./types";
import { createFact, fileExists } from "./utils";

interface LoopResult {
  cognitiveState: CognitiveState;
  decision: ExecutorDecision;
  resultSummary: string;
}

interface LoopOptions {
  triggerMessage: string;
  printExecutorMessages: boolean;
}

export class AgenterLoop {
  private readonly memory: MemoryManager;
  private readonly rememberer: Rememberer;
  private readonly model: string;
  private readonly demoPath: string;

  constructor(memory: MemoryManager, rememberer: Rememberer, model: string, demoPath: string) {
    this.memory = memory;
    this.rememberer = rememberer;
    this.model = model;
    this.demoPath = demoPath;
  }

  async runLoop(options: LoopOptions): Promise<LoopResult> {
    const cognitiveState = await this.rememberer.recall(options.triggerMessage);

    // Context reconstruction: build a fresh message array from cognitiveState only.
    const executorMessages = this.buildExecutorMessages(cognitiveState, options.triggerMessage);

    if (options.printExecutorMessages) {
      console.log("\n[Executor Messages]");
      console.log(JSON.stringify(executorMessages, null, 2));
    }

    const decision = await this.decideNextAction(executorMessages, cognitiveState);
    const resultSummary = await this.executeDecision(decision);

    await this.memory.appendFact(
      createFact("AI_THOUGHT", `Decision: ${decision.action}. ${decision.reasoning}`, {
        action: decision.action,
        target_path: decision.target_path,
      })
    );

    await this.memory.appendFact(
      createFact("TOOL_RESULT", resultSummary, {
        action: decision.action,
        target_path: decision.target_path,
      })
    );

    return { cognitiveState, decision, resultSummary };
  }

  private buildExecutorMessages(cognitiveState: CognitiveState, triggerMessage: string): Message[] {
    const systemPrompt = [
      "You are an executor.",
      "TASK: CHOOSE_ACTION",
      "Given COGNITIVE_STATE_JSON, choose one action: CREATE_FILE, READ_FILE, DELETE_FILE, DONE.",
      `TARGET_PATH=${this.demoPath}`,
      `COGNITIVE_STATE_JSON=${JSON.stringify(cognitiveState)}`,
    ].join("\n");

    // IMPORTANT: This is a brand-new context. No prior chat history is appended.
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: triggerMessage },
    ];
  }

  private async decideNextAction(
    messages: Message[],
    cognitiveState: CognitiveState
  ): Promise<ExecutorDecision> {
    const response = await callAI(messages, this.model);
    const parsed = parseExecutorDecision(response);
    if (parsed) return parsed;
    return this.fallbackDecision(cognitiveState);
  }

  private fallbackDecision(cognitiveState: CognitiveState): ExecutorDecision {
    const goal = cognitiveState.current_goal.toLowerCase();
    if (goal.includes("create")) {
      return { action: "CREATE_FILE", reasoning: "Fallback: create", target_path: this.demoPath };
    }
    if (goal.includes("read")) {
      return { action: "READ_FILE", reasoning: "Fallback: read", target_path: this.demoPath };
    }
    if (goal.includes("delete")) {
      return { action: "DELETE_FILE", reasoning: "Fallback: delete", target_path: this.demoPath };
    }
    return { action: "DONE", reasoning: "Fallback: none", target_path: this.demoPath };
  }

  private async executeDecision(decision: ExecutorDecision): Promise<string> {
    const targetPath = path.resolve(decision.target_path);
    switch (decision.action) {
      case "CREATE_FILE": {
        await fs.writeFile(targetPath, "Hello World", "utf-8");
        return `Created file at ${targetPath}`;
      }
      case "READ_FILE": {
        const exists = await fileExists(targetPath);
        if (!exists) {
          return `Read failed, file missing at ${targetPath}`;
        }
        const content = await fs.readFile(targetPath, "utf-8");
        return `Read file at ${targetPath}: ${content}`;
      }
      case "DELETE_FILE": {
        const exists = await fileExists(targetPath);
        if (!exists) {
          return `Delete skipped, file missing at ${targetPath}`;
        }
        await fs.unlink(targetPath);
        return `Deleted file at ${targetPath}`;
      }
      case "DONE":
      default:
        return "No action required";
    }
  }
}
