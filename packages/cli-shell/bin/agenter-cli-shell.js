#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const distEntry = new URL("../dist/agenter-cli-shell.js", import.meta.url);
const sourceEntry = new URL("../src/bin/agenter-cli-shell.ts", import.meta.url);

await import(existsSync(fileURLToPath(sourceEntry)) ? sourceEntry.href : distEntry.href);
