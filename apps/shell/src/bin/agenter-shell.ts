#!/usr/bin/env bun

import { runShell } from "../run-shell";

try {
  const result = await runShell(process.argv);
  process.exitCode = result.exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
