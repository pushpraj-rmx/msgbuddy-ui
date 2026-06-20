import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Plugin-free config: @vitejs/plugin-react targets a newer Vite than the one
// Vitest 2 ships, so we lean on esbuild's automatic JSX transform and a manual
// "@/" → src alias (mirrors tsconfig paths) instead.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
