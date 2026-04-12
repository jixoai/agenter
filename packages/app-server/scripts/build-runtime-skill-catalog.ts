import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRuntimeBuiltinSkillCatalog,
  renderRuntimeBuiltinSkillCatalogModule,
} from "../src/runtime-skill-catalog-builder";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const outputPath = fileURLToPath(new URL("../src/generated/runtime-skill-catalog.generated.ts", import.meta.url));
const catalog = buildRuntimeBuiltinSkillCatalog(repoRoot);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderRuntimeBuiltinSkillCatalogModule(catalog), "utf8");

console.log(`wrote ${catalog.length} runtime built-in skills to ${outputPath}`);
