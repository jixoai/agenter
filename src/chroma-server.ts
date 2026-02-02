import os from "os";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { ensureDir, fileExists } from "./utils";

let chromaProcess: ChildProcess | null = null;
let chromaUrl: string | null = null;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getBinaryPath = async (): Promise<string> => {
  if (process.env.CHROMA_BIN) return process.env.CHROMA_BIN;
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
  if (process.env.CHROMA_URL) return process.env.CHROMA_URL;
  if (process.env.CHROMA_AUTO_START === "0") return null;
  if (chromaUrl) return chromaUrl;

  const host = process.env.CHROMA_HOST ?? "127.0.0.1";
  const port = Number(process.env.CHROMA_PORT ?? "8000");
  const dataDir = process.env.CHROMA_DATA_DIR ?? path.join(os.homedir(), ".agenter-demo", "chroma-data");
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
