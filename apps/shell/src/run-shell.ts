import { hideBin } from "yargs/helpers";

import { startShellApp } from "./app/shell-app";
import { startFourPaneRendererGridDemo } from "./demos/renderer-grid-demo";
import {
  createShellHelpText,
  isShellMetadataOnlyAppArgv,
  parseShellArgs,
} from "./app-runtime/argv";
import {
  defaultShellAppRunDependencies,
  runShellCleanup,
  runShellAppAttach,
  type ShellAppRunDependencies,
} from "./app-runtime/runtime";

export interface ShellRunResult {
  exitCode: number;
}

const helpTokens = new Set(["--help", "-h", "help"]);

export const isShellMetadataOnlyArgv = (argv: readonly string[]): boolean =>
  isShellMetadataOnlyAppArgv(argv);

const isShellVersionArgv = (argv: readonly string[]): boolean =>
  argv.some((token) => token === "--version" || token === "-v") || argv[0] === "version";

export const runShell = async (
  argv: readonly string[] = process.argv,
  dependencies: ShellAppRunDependencies = defaultShellAppRunDependencies,
): Promise<ShellRunResult> => {
  const args = hideBin([...argv]);
  if (isShellMetadataOnlyArgv(args)) {
    if (isShellVersionArgv(args)) {
      console.log("agenter-shell 0.0.0");
      return { exitCode: 0 };
    }
    console.log(await createShellHelpText(args.filter((token) => !helpTokens.has(token))));
    return { exitCode: 0 };
  }
  const parsed = parseShellArgs(args);

  if (parsed.command === "renderer-grid-demo") {
    await startFourPaneRendererGridDemo({
      selectionText: parsed.selectionText,
    });
    return { exitCode: 0 };
  }
  if (parsed.command === "unsupported-tmux-action") {
    throw new Error(`unsupported-tmux-action: ${parsed.action}`);
  }
  if (parsed.command === "cleanup") {
    return await runShellCleanup(parsed, dependencies);
  }
  if (parsed.command !== "local") {
    return await runShellAppAttach(parsed, dependencies);
  }
  const app = await startShellApp({
    cwd: parsed.cwd,
    command: parsed.shellCommand,
  });
  await app.finished;
  return { exitCode: 0 };
};
