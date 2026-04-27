import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { build } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(packageRoot, "src/server/webauthn-ui");

const buildEntry = async (name, entry) => {
  await build({
    root: packageRoot,
    logLevel: "error",
    plugins: [svelte()],
    build: {
      emptyOutDir: false,
      outDir: outputDir,
      target: "esnext",
      minify: false,
      cssCodeSplit: false,
      lib: {
        entry: resolve(packageRoot, entry),
        formats: ["es"],
        fileName: () => `${name}.js`,
      },
      rollupOptions: {
        output: {
          entryFileNames: `${name}.js`,
          assetFileNames: () => `${name}[extname]`,
        },
      },
    },
  });
};

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(dirname(outputDir), { recursive: true });
mkdirSync(outputDir, { recursive: true });

await buildEntry("register", "src/webauthn-ui-src/entry-register.ts");
await buildEntry("authenticate", "src/webauthn-ui-src/entry-authenticate.ts");
