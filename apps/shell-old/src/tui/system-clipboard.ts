import { execFile } from "node:child_process";
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
