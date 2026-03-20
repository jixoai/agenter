import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      "@base-ui-components/react/accordion",
      "@base-ui-components/react/dialog",
      "@base-ui-components/react/menu",
      "@base-ui-components/react/tooltip",
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
          exclude: ["test/storybook/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "storybook",
          setupFiles: ["./test/setup.ts", "./.storybook/vitest.setup.ts"],
          include: ["test/storybook/**/*.test.tsx"],
          browser: {
            enabled: true,
            provider: "playwright",
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
