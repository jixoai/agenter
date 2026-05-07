import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(packageRoot, "dist");
const entrypoint = resolve(packageRoot, "src/bin/agenter.ts");

await rm(distDir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: distDir,
  target: "bun",
  format: "esm",
  external: ["@duckdb/node-api"],
  splitting: true,
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log.message);
  }
  process.exitCode = 1;
}
