import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const readClipboardCandidate = async (command: string, args: readonly string[]): Promise<string | null> => {
  try {
    const result = await execFileAsync(command, [...args], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return String(result.stdout ?? "");
  } catch {
    return null;
  }
};

const writeClipboardCandidate = async (command: string, args: readonly string[], text: string): Promise<boolean> => {
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, [...args], {
        windowsHide: true,
        stdio: ["pipe", "ignore", "ignore"],
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`${command} exited with code ${code ?? -1}`));
      });
      child.stdin.end(text);
    });
    return true;
  } catch {
    return false;
  }
};

export const readSystemClipboardText = async (): Promise<string | null> => {
  if (process.platform === "darwin") {
    return await readClipboardCandidate("pbpaste", []);
  }
  if (process.platform === "win32") {
    return await readClipboardCandidate("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard"]);
  }
  return (
    await readClipboardCandidate("wl-paste", ["--no-newline"])
  ) ?? (
    await readClipboardCandidate("xclip", ["-selection", "clipboard", "-o"])
  ) ?? (
    await readClipboardCandidate("xsel", ["--clipboard", "--output"])
  );
};

export const writeSystemClipboardText = async (text: string): Promise<boolean> => {
  if (text.length === 0) {
    return false;
  }
  if (process.platform === "darwin") {
    return await writeClipboardCandidate("pbcopy", [], text);
  }
  if (process.platform === "win32") {
    return await writeClipboardCandidate("clip.exe", [], text);
  }
  return (
    await writeClipboardCandidate("wl-copy", [], text)
  ) || (
    await writeClipboardCandidate("xclip", ["-selection", "clipboard"], text)
  ) || (
    await writeClipboardCandidate("xsel", ["--clipboard", "--input"], text)
  );
};
