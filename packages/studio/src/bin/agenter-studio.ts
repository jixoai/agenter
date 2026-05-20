#!/usr/bin/env bun

import { runStudio } from "../run-studio";

try {
  await runStudio(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
