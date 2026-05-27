import { hideBin } from "yargs/helpers";

import { startShellNextApp } from "./app/shell-next-app";
import { startFourPaneRendererGridDemo } from "./demos/renderer-grid-demo";
import {
  createShellNextHelpText,
  isShellNextMetadataOnlyProductArgv,
  parseShellNextArgs,
} from "./product/argv";
import {
  defaultShellNextProductRunDependencies,
  runShellNextCleanup,
  runShellNextProductAttach,
  type ShellNextProductRunDependencies,
} from "./product/runtime";

export interface ShellNextRunResult {
  exitCode: number;
}

const helpTokens = new Set(["--help", "-h", "help"]);

export const isShellNextMetadataOnlyArgv = (argv: readonly string[]): boolean =>
  isShellNextMetadataOnlyProductArgv(argv);

const isShellNextVersionArgv = (argv: readonly string[]): boolean =>
  argv.some((token) => token === "--version" || token === "-v") || argv[0] === "version";

export const runShellNext = async (
  argv: readonly string[] = process.argv,
  dependencies: ShellNextProductRunDependencies = defaultShellNextProductRunDependencies,
): Promise<ShellNextRunResult> => {
  const args = hideBin([...argv]);
  if (isShellNextMetadataOnlyArgv(args)) {
    if (isShellNextVersionArgv(args)) {
      console.log("agenter-shell-next 0.0.0");
      return { exitCode: 0 };
    }
    console.log(await createShellNextHelpText(args.filter((token) => !helpTokens.has(token))));
    return { exitCode: 0 };
  }
  const parsed = parseShellNextArgs(args);

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
    return await runShellNextCleanup(parsed, dependencies);
  }
  if (parsed.command !== "local") {
    return await runShellNextProductAttach(parsed, dependencies);
  }
  const app = await startShellNextApp({
    cwd: parsed.cwd,
    command: parsed.shellCommand,
  });
  await app.finished;
  return { exitCode: 0 };
};
