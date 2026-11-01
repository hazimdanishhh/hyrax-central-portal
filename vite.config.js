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
  // Vitest (2026-10-22): unit tests for pure helpers. `npm test`. (The SQL
  // tests moved to hyrax-supabase on 2026-11-01.)
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
