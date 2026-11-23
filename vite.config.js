import { defineConfig } from "vite";
import { resolve } from "node:path";

// Static build: relative base so dist/ can be served from any path.
// Two pages: index.html (the app) and deploy.html (one-click deploy for the owner).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        deploy: resolve(__dirname, "deploy.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
