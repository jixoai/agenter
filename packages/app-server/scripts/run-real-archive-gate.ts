import { fileURLToPath } from "node:url";

import { REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";

interface RealSuite {
  readonly label: string;
  readonly args: string[];
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

const suites: readonly RealSuite[] = [
  {
    label: "LoopBus core minimal reply",
    args: ["test", "test/real-loopbus.integration.test.ts", "-t", "minimal chat request"],
  },
  {
    label: "MessageSystem follow-up reminder",
    args: ["test", "test/real-message-follow-up.integration.test.ts"],
  },
  {
    label: "TerminalSystem room delivery",
    args: ["test", "test/real-room-terminal.integration.test.ts"],
  },
  {
    label: "Skill/Workspace multi-workspace runtime",
    args: ["test", "test/real-multi-workspace.integration.test.ts"],
  },
];

const runSuite = async (suite: RealSuite): Promise<void> => {
  console.log(`\n[real-archive-gate] start: ${suite.label}`);
  const startedAt = Date.now();
  const proc = Bun.spawn({
    cmd: ["bun", ...suite.args],
    cwd: packageRoot,
    env: {
      ...process.env,
      AGENTER_RUN_REAL_LOOPBUS: process.env.AGENTER_RUN_REAL_LOOPBUS?.trim() || "1",
    },
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const exitCode = await proc.exited;
  const elapsedMs = Date.now() - startedAt;
  if (exitCode !== 0) {
    throw new Error(`[real-archive-gate] failed: ${suite.label} (exit ${exitCode}, ${elapsedMs}ms)`);
  }
  console.log(`[real-archive-gate] pass: ${suite.label} (${elapsedMs}ms)`);
};

const main = async (): Promise<void> => {
  const config = resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT);
  if (!config) {
    throw new Error("real archive gate requires a configured real provider");
  }

  console.log("[real-archive-gate] provider ready");
  console.log(
    `[real-archive-gate] provider=${config.vendor}/${config.apiStandard} model=${config.model} baseUrl=${config.baseUrl}`,
  );

  for (const suite of suites) {
    await runSuite(suite);
  }

  console.log("\n[real-archive-gate] all suites passed");
};

await main();
