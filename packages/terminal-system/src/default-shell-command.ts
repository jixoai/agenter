import { existsSync } from "node:fs";
import { basename, delimiter, isAbsolute, join } from "node:path";

const findExecutableOnPath = (command: string): string | null => {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return null;
  }
  for (const segment of pathValue.split(delimiter)) {
    if (!segment) {
      continue;
    }
    const candidate = join(segment, command);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const resolveExecutable = (candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (isAbsolute(candidate)) {
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    const resolved = findExecutableOnPath(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

/**
 * Shared terminals need an automation-stable interactive shell, not merely the
 * host account's current login shell preference.
 */
export const resolveDefaultInteractiveShellCommand = (): string[] => {
  if (process.platform === "win32") {
    return [process.env.ComSpec ?? "cmd.exe"];
  }

  const bash = resolveExecutable(["/bin/bash", "/usr/bin/bash", "bash"]);
  if (bash) {
    return [bash, "-i"];
  }

  const shell = resolveExecutable([process.env.SHELL ?? "", "/bin/sh", "/usr/bin/sh", "sh"]);
  if (shell) {
    return basename(shell) === "bash" ? [shell, "-i"] : [shell, "-i"];
  }

  return ["/bin/sh", "-i"];
};
