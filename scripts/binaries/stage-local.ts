#!/usr/bin/env bun
import { parseArgs } from "node:util";

import {
  normalizeGhosttyArch,
  normalizeGhosttyPackageOs,
  resolveGhosttyNativePackageTarget,
  resolveGhosttyNativeTarget,
  stageArtifact,
} from "./artifacts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    source: {
      type: "string",
    },
    root: {
      type: "string",
      default: process.cwd(),
    },
    "package-os": {
      type: "string",
    },
    arch: {
      type: "string",
    },
  },
});

if (values.source === undefined || values.source.length === 0) {
  throw new Error("--source is required");
}

if ((values["package-os"] === undefined) !== (values.arch === undefined)) {
  throw new Error("--package-os and --arch must be provided together");
}

const target =
  values["package-os"] === undefined
    ? resolveGhosttyNativeTarget()
    : resolveGhosttyNativePackageTarget(
        normalizeGhosttyPackageOs(values["package-os"]),
        normalizeGhosttyArch(values.arch),
      );

await stageArtifact(values.root ?? process.cwd(), values.source, target.artifactPath);
console.log(`staged ghostty-native artifact: ${target.artifactPath}`);
