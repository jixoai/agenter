import { runCoreDemoApp } from "./app/core-demo-app";
import { parseRuntimeConfig } from "./app/runtime-config";

const runtimeConfig = await parseRuntimeConfig(process.argv.slice(2), process.cwd());
await runCoreDemoApp(runtimeConfig);
