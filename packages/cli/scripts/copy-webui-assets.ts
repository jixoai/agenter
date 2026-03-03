import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const sourceDir = join(import.meta.dir, "../../webui/dist");
const targetDir = join(import.meta.dir, "../assets/webui");

if (!existsSync(sourceDir)) {
  throw new Error(`webui dist not found: ${sourceDir}. run \`bun run --filter '@agenter/webui' build\` first.`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`copied webui dist -> ${targetDir}`);
