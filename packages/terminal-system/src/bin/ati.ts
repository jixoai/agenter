#!/usr/bin/env bun

import { runAtiCli } from "../cli/ati-cli";

try {
  const code = await runAtiCli();
  process.exitCode = code;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ati: ${message}\n`);
  process.exitCode = 1;
}
