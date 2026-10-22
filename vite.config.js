import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // alias for "@/styles/variables"
    },
  },
  // Vitest (2026-10-22): SQL tests that run supabase/sql_editor files against
  // an in-process Postgres (PGlite), same setup as echoes-hub. `npm test`.
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;`, // injects into each .scss file
      },
    },
  },
});
