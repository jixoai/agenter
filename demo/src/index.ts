import { resolve } from "node:path";

import { runCoreDemoApp } from "./app/core-demo-app";
import { parseRuntimeConfig } from "./app/runtime-config";

const args = [...process.argv.slice(2)];
const demoConfigDir = resolve(import.meta.dir, "..", ".agenter");
const hasSettingsSource = args.some((arg) => arg === "--settings-source" || arg.startsWith("--settings-source="));
if (!hasSettingsSource) {
  args.push(`--settings-source=${demoConfigDir}`);
}
const hasGitLog = args.some((arg) => arg === "--git-log" || arg.startsWith("--git-log="));
if (!hasGitLog) {
  args.push("--git-log=normal");
}

const runtimeConfig = await parseRuntimeConfig(args, process.cwd());

await runCoreDemoApp(runtimeConfig);
