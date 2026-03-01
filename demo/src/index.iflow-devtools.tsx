import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { parseRuntimeConfig } from "./app/runtime-config";
import { TerminalDevtoolsApp } from "./devtools/terminal-devtools-app";

const args = [...process.argv.slice(2)];
const hasCmd = args.some((arg) => arg === "--cmd" || arg.startsWith("--cmd="));
if (!hasCmd) {
  args.push("--cmd=iflow");
}
const hasGitLog = args.some((arg) => arg === "--git-log" || arg.startsWith("--git-log="));
if (!hasGitLog) {
  args.push("--git-log=normal");
}

const runtimeConfig = parseRuntimeConfig(args, process.cwd());

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  useMouse: true,
});

createRoot(renderer).render(<TerminalDevtoolsApp runtimeConfig={runtimeConfig} />);
