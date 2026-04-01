import { startE2EServerHarness } from "./server-harness";

const main = async (): Promise<void> => {
  const harness = await startE2EServerHarness();
  const args = process.argv.slice(2);
  const proc = Bun.spawn({
    cmd: ["playwright", "test", ...args],
    cwd: join(import.meta.dir, "../.."),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: harness.baseUrl,
    },
  });

  try {
    const exitCode = await proc.exited;
    process.exit(exitCode);
  } finally {
    await harness.stop();
  }
};

import { join } from "node:path";

await main();
