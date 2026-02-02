import os from "os";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { ensureDir, fileExists } from "./utils";
import { chromaConfig } from "./env.js";

let chromaProcess: ChildProcess | null = null;
let chromaUrl: string | null = null;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getBinaryPath = async (): Promise<string> => {
  if (chromaConfig.bin) return chromaConfig.bin;
  const binName = process.platform === "win32" ? "chroma.cmd" : "chroma";
  const localPath = path.join(process.cwd(), "node_modules", ".bin", binName);
  if (await fileExists(localPath)) return localPath;
  return binName;
};

const waitForReady = async (url: string, retries = 20, intervalMs = 250): Promise<boolean> => {
  const health = `${url.replace(/\/$/, "")}/api/v1/heartbeat`;
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(health);
      if (response.ok) return true;
    } catch {
      // ignore
    }
    await sleep(intervalMs);
  }
  return false;
};

export const ensureChromaServer = async (): Promise<string | null> => {
  if (chromaConfig.url) return chromaConfig.url;
  if (!chromaConfig.autoStart) return null;
  if (chromaUrl) return chromaUrl;

  const host = chromaConfig.host;
  const port = chromaConfig.port;
  const dataDir = chromaConfig.dataDir ?? path.join(os.homedir(), ".agenter-demo", "chroma-data");
  await ensureDir(dataDir);

  const binPath = await getBinaryPath();
  const args = ["run", "--path", dataDir, "--host", host, "--port", String(port)];

  chromaProcess = spawn(binPath, args, {
    stdio: "ignore",
    detached: false,
  });

  chromaUrl = `http://${host}:${port}`;
  const startOk = await Promise.race([
    waitForReady(chromaUrl),
    new Promise<boolean>((resolve) => {
      chromaProcess?.once("error", () => resolve(false));
    }),
  ]);
  if (!startOk) {
    chromaUrl = null;
    return null;
  }

  const cleanup = () => {
    if (chromaProcess && !chromaProcess.killed) {
      chromaProcess.kill();
    }
  };

  process.once("exit", cleanup);
  process.once("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  return chromaUrl;
};
