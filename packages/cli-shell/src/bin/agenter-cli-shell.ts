#!/usr/bin/env bun

import { runCliShell } from "../run-cli-shell";

try {
  await runCliShell(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
