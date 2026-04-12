import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { assertWebUiStaticDir } from "../src/webui-static-root";

const sourceDir = join(import.meta.dir, "../../webui/build");
const targetDir = join(import.meta.dir, "../assets/webui");

if (!existsSync(sourceDir)) {
  throw new Error(`webui build not found: ${sourceDir}. run \`bun run build:webui\` first.`);
}

assertWebUiStaticDir(sourceDir, "run `bun run build:webui` first.");

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`copied canonical webui build -> packaging artifact ${targetDir}`);
