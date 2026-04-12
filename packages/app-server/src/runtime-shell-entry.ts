import { spawn } from "node:child_process";

import { InMemoryFs } from "just-bash";

import { createRuntimeShellCommands } from "./runtime-cli";
import {
  RUNTIME_API_BASE_URL_ENV,
  RUNTIME_HOME_DIR_ENV,
  RUNTIME_PRINCIPAL_ID_ENV,
  RUNTIME_PRIVATE_KEY_ENV,
  RUNTIME_ROOT_WORKSPACE_ENV,
} from "./runtime-skills";
import { materializeRuntimeShellBin, resolveRuntimeShellBinDir } from "./runtime-shell-bin";

const readStdin = async (): Promise<string> =>
  process.stdin.isTTY
    ? ""
    : await new Promise((resolveText, rejectText) => {
        const chunks: Uint8Array[] = [];
        process.stdin.on("data", (chunk) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        process.stdin.on("end", () => {
          resolveText(Buffer.concat(chunks).toString("utf8"));
        });
        process.stdin.on("error", rejectText);
      });

const execShellCommand = async (input: {
  command: string;
  cwd: string;
  env: Record<string, string>;
  stdin: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  await new Promise((resolveResult, rejectResult) => {
    const child = spawn("/bin/zsh", ["-lc", input.command], {
      cwd: input.cwd,
      env: input.env,
      stdio: "pipe",
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    child.on("error", rejectResult);
    child.on("close", (code) => {
      resolveResult({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code ?? 1,
      });
    });

    if (input.stdin.length > 0) {
      child.stdin.write(input.stdin);
    }
    child.stdin.end();
  });

const main = async (): Promise<void> => {
  const [commandName, ...args] = process.argv.slice(2);
  if (!commandName) {
    process.stderr.write("runtime shell wrapper requires <command>\n");
    process.exit(1);
  }

  const baseUrl = process.env[RUNTIME_API_BASE_URL_ENV];
  const privateKey = process.env[RUNTIME_PRIVATE_KEY_ENV];
  const rootWorkspacePath = process.env[RUNTIME_ROOT_WORKSPACE_ENV];
  const homeDir = process.env[RUNTIME_HOME_DIR_ENV];
  if (!baseUrl || !privateKey || !rootWorkspacePath || !homeDir) {
    process.stderr.write("runtime shell wrapper is missing required environment\n");
    process.exit(1);
  }

  materializeRuntimeShellBin(rootWorkspacePath);
  const runtimeEnv = Object.fromEntries(
    Object.entries({
      ...process.env,
      PATH: `${resolveRuntimeShellBinDir(rootWorkspacePath)}:${process.env.PATH ?? ""}`,
    }).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  );

  const command = createRuntimeShellCommands({
    baseUrl,
    privateKey,
    homeDir,
    rootWorkspacePath,
    principalId: process.env[RUNTIME_PRINCIPAL_ID_ENV],
  }).find((entry) => entry.name === commandName);
  if (!command) {
    process.stderr.write(`unknown runtime shell command: ${commandName}\n`);
    process.exit(1);
  }

  const result = await command.execute(args, {
    fs: new InMemoryFs(),
    cwd: process.cwd(),
    env: new Map(Object.entries(runtimeEnv)),
    stdin: await readStdin(),
    exec: async (shellCommand, ctx) =>
      await execShellCommand({
        command: shellCommand,
        cwd: ctx.cwd,
        env: ctx.env ?? runtimeEnv,
        stdin: ctx.stdin ?? "",
      }),
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.exitCode);
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
