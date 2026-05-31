import { releaseToolchain } from "./release-manifest";

const run = async (cmd: string[]): Promise<void> => {
  const proc = Bun.spawn({
    cmd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed with exit code ${exitCode}`);
  }
};

const readStdout = async (cmd: string[]): Promise<string> => {
  const proc = Bun.spawn({
    cmd,
    stdout: "pipe",
    stderr: "inherit",
  });
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed with exit code ${exitCode}`);
  }
  return stdout.trim();
};

const assertBunVersion = async (): Promise<void> => {
  const actual = await readStdout(["bun", "--version"]);
  if (actual !== releaseToolchain.bunVersion) {
    throw new Error(`release requires Bun ${releaseToolchain.bunVersion}, got ${actual}`);
  }
};

const main = async (): Promise<void> => {
  const skipInstall = process.argv.includes("--skip-install");
  await assertBunVersion();
  if (!skipInstall) {
    await run(["bun", "install", "--frozen-lockfile"]);
  }
  await run(["bun", "test", "scripts/release/release-bundles.test.ts"]);
  await run(["bun", "run", "release:build-bundles"]);
};

await main();
