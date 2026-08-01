import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@som/shared": resolve(__dirname, "../../packages/shared/src/index.ts")
    }
  }
});
