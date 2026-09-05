import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  root: "./src",
  plugins: [solidPlugin(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../dist",
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      exclude: [/src-tauri/, /target/],
    },
  },
});
