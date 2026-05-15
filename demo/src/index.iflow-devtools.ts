import { runCoreDemoApp } from "./app/core-demo-app";
import { parseRuntimeConfig } from "./app/runtime-config";

const args = [...process.argv.slice(2)];
const hasCmd = args.some((arg) => arg === "--cmd" || arg.startsWith("--cmd="));
if (!hasCmd) {
  args.push("--cmd=iflow");
}
const hasGitLog = args.some((arg) => arg === "--git-log" || arg.startsWith("--git-log="));
if (!hasGitLog) {
  args.push("--git-log=normal");
}

const runtimeConfig = await parseRuntimeConfig(args, process.cwd());
await runCoreDemoApp(runtimeConfig);
