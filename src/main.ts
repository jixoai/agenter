import { promises as fs } from "fs";
import { MemoryManager } from "./memory-manager";
import { Rememberer } from "./rememberer";
import { AgenterLoop } from "./agenter-loop";
import { createFact, fileExists } from "./utils";
import { loadRuntimeConfig } from "./config";

const DEMO_USER_MESSAGE = "帮我创建一个 Hello World 文件，然后读取它，最后删除它。";

interface DemoOptions {
  reset: boolean;
  maxLoops: number;
}

const parseArgs = (argv: string[]): DemoOptions => {
  const options: DemoOptions = {
    reset: false,
    maxLoops: 3,
  };
  for (const arg of argv) {
    if (arg === "--reset") {
      options.reset = true;
    } else if (arg.startsWith("--max-loops=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.maxLoops = value;
      }
    }
  }
  return options;
};

const resetDemoArtifacts = async (memory: MemoryManager, demoPath: string): Promise<void> => {
  await memory.reset();
  if (await fileExists(demoPath)) {
    await fs.unlink(demoPath);
  }
};

export const runDemo = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const { model, storageDir, demoPath } = await loadRuntimeConfig();

  const memory = new MemoryManager(storageDir);
  const rememberer = new Rememberer(memory, model);
  const loop = new AgenterLoop(memory, rememberer, model, demoPath);

  if (options.reset) {
    await resetDemoArtifacts(memory, demoPath);
  }

  const hadUserMessage = await memory.hasUserMessage(DEMO_USER_MESSAGE);
  if (!hadUserMessage) {
    await memory.appendFact(createFact("USER_MSG", DEMO_USER_MESSAGE));
  }

  for (let index = 0; index < options.maxLoops; index += 1) {
    const trigger = index === 0 && !hadUserMessage ? DEMO_USER_MESSAGE : "SYSTEM: continue";
    const printMessages = index >= 1;
    const result = await loop.runLoop({
      triggerMessage: trigger,
      printExecutorMessages: printMessages,
    });

    console.log(`\n[Loop ${index + 1}]`);
    console.log(`Goal: ${result.cognitiveState.current_goal}`);
    console.log(`Decision: ${result.decision.action}`);
    console.log(`Result: ${result.resultSummary}`);

    if (result.decision.action === "DONE") {
      break;
    }
  }
};

if (import.meta.main) {
  runDemo().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
