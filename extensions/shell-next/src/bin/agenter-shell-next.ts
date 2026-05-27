#!/usr/bin/env bun

import { runShellNext } from "../run-shell-next";

try {
  const result = await runShellNext(process.argv);
  process.exitCode = result.exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
