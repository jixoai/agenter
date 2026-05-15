import { readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidateRoots = [resolve(packageRoot, "src"), resolve(packageRoot, "test")];
const forwardedArgs = process.argv.slice(2);

const walkFiles = (root: string): string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const nextPath = join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(nextPath));
      continue;
    }
    if (extname(entry.name) !== ".ts" || !entry.name.endsWith(".test.ts")) {
      continue;
    }
    results.push(nextPath);
  }
  return results;
};

const allTestFiles = candidateRoots.flatMap((root) => walkFiles(root)).sort((left, right) => left.localeCompare(right));

const explicitFileArgs = forwardedArgs.filter((arg) => arg.endsWith(".ts"));
const extraArgs = forwardedArgs.filter((arg) => !arg.endsWith(".ts"));

const selectedTestFiles =
  explicitFileArgs.length > 0
    ? explicitFileArgs.map((arg) => (arg.startsWith("/") ? arg : resolve(packageRoot, arg)))
    : allTestFiles;

if (selectedTestFiles.length === 0) {
  console.error("[app-server:test] no test files selected");
  process.exit(1);
}

for (const filePath of selectedTestFiles) {
  const label = relative(packageRoot, filePath);
  console.log(`[app-server:test] start ${label}`);
  const proc = Bun.spawn({
    cmd: ["bun", "test", filePath, ...extraArgs],
    cwd: packageRoot,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: process.env,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`[app-server:test] fail ${label} (exit ${exitCode})`);
    process.exit(exitCode);
  }
  console.log(`[app-server:test] pass ${label}`);
}

console.log(`[app-server:test] all ${selectedTestFiles.length} files passed`);
