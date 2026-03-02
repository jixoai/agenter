import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { parseRuntimeConfig } from "./app/runtime-config";
import { TerminalDevtoolsApp } from "./devtools/terminal-devtools-app";

const runtimeConfig = await parseRuntimeConfig(process.argv.slice(2), process.cwd());

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  useMouse: true,
});

createRoot(renderer).render(<TerminalDevtoolsApp runtimeConfig={runtimeConfig} />);
